import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapView, type MapStop } from "@/components/MapView";
import { StatusBadge } from "./admin.buses";
import { toast } from "sonner";
import { Play, Square, MapPin, Home, Loader2 } from "lucide-react";
import { haversine } from "@/lib/routing";
import { fmtTime, fmtDistance, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/driver")({ component: DriverPage });

interface Driver { id: string; name: string; }
interface TripFull {
  id: string; status: string; scheduled_start_time: string; actual_start_time: string | null;
  route_id: string; bus_id: string; driver_id: string;
  routes: { route_name: string; route_geometry: unknown } | null;
  buses: { bus_number: string; bus_name: string } | null;
  drivers: { name: string } | null;
}

function DriverPage() {
  const qc = useQueryClient();
  const [driverId, setDriverId] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("smart-bus-driver-id") ?? "" : ""));

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-select"],
    queryFn: async () => (await supabase.from("drivers").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  useEffect(() => {
    if (driverId) localStorage.setItem("smart-bus-driver-id", driverId);
  }, [driverId]);

  const { data: trip, isLoading } = useQuery({
    queryKey: ["driver-trip", driverId],
    enabled: !!driverId,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("trips")
        .select("*, routes(route_name,route_geometry), buses(bus_number,bus_name), drivers(name)")
        .eq("driver_id", driverId)
        .in("status", ["scheduled", "active", "delayed"])
        .order("scheduled_start_time", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as TripFull | null;
    },
  });

  const { data: stops = [] } = useQuery({
    queryKey: ["driver-stops", trip?.route_id],
    enabled: !!trip?.route_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("route_stops")
        .select("stop_order, stops(id,stop_name,latitude,longitude)").eq("route_id", trip!.route_id).order("stop_order");
      if (error) throw error;
      return data as never as { stop_order: number; stops: { id: string; stop_name: string; latitude: number; longitude: number } }[];
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-muted rounded-lg"><Home size={16} /></Link>
          <div className="flex-1">
            <div className="font-bold">Driver</div>
            <div className="text-[11px] text-muted-foreground">{trip?.drivers?.name ?? "Not signed in"}</div>
          </div>
          <select value={driverId} onChange={(e) => { setDriverId(e.target.value); qc.invalidateQueries(); }} className="px-2 py-1.5 rounded-lg border bg-background text-sm max-w-[160px]">
            <option value="">Select driver…</option>
            {(drivers as Driver[]).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4">
        {!driverId ? (
          <EmptyCard title="Sign in to continue" desc="Select your driver profile above to see your assigned trip." />
        ) : isLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="animate-spin" /></div>
        ) : !trip ? (
          <EmptyCard title="No active trip has been assigned." desc="Once the administrator schedules a trip for you, it will appear here." />
        ) : (
          <TripPanel trip={trip} stops={stops} />
        )}
      </main>
    </div>
  );
}

function EmptyCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-card border rounded-2xl p-10 text-center">
      <div className="text-5xl mb-3">🚌</div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}

function TripPanel({ trip, stops }: { trip: TripFull; stops: { stop_order: number; stops: { id: string; stop_name: string; latitude: number; longitude: number } }[] }) {
  const qc = useQueryClient();
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const [tracking, setTracking] = useState(false);

  const polyline = (trip.routes?.route_geometry as [number, number][] | null) ?? [];
  const mapStops: MapStop[] = stops.map((s, i) => ({
    id: s.stops.id, name: s.stops.stop_name, lat: s.stops.latitude, lng: s.stops.longitude,
    kind: i === 0 ? "start" : i === stops.length - 1 ? "end" : "stop",
  }));

  const isActive = trip.status === "active" || trip.status === "delayed";

  const startWatch = () => {
    if (!navigator.geolocation) { setGpsError("Browser does not support geolocation"); return false; }
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => { setPos(p); setGpsError(null); sendLocation(p); },
      (e) => { setGpsError(e.message); setTracking(false); toast.error(`GPS: ${e.message}`); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return true;
  };

  const stopWatch = () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setTracking(false);
  };

  const sendLocation = async (p: GeolocationPosition) => {
    const now = Date.now();
    const last = lastSentRef.current;
    if (last) {
      const dt = (now - last.t) / 1000;
      const dist = haversine({ lat: last.lat, lng: last.lng }, { lat: p.coords.latitude, lng: p.coords.longitude });
      if (dt < 3 && dist < 10) return;
    }
    lastSentRef.current = { lat: p.coords.latitude, lng: p.coords.longitude, t: now };
    await supabase.from("driver_locations").insert({
      trip_id: trip.id, driver_id: trip.driver_id, bus_id: trip.bus_id,
      latitude: p.coords.latitude, longitude: p.coords.longitude,
      speed: p.coords.speed, heading: p.coords.heading, accuracy: p.coords.accuracy,
    });
  };

  // Auto-start tracking when trip is active
  useEffect(() => {
    if (isActive && !tracking) startWatch();
    return () => stopWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const start = useMutation({
    mutationFn: async () => {
      // request permission first
      const ok = startWatch();
      if (!ok) throw new Error("Cannot start GPS tracking");
      const now = new Date().toISOString();
      const { error } = await supabase.from("trips").update({ status: "active", actual_start_time: now }).eq("id", trip.id);
      if (error) throw error;
      await supabase.from("buses").update({ status: "running" }).eq("id", trip.bus_id);
      await supabase.from("drivers").update({ status: "on_trip" }).eq("id", trip.driver_id);
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Trip started"); },
    onError: (e: Error) => { stopWatch(); toast.error(e.message); },
  });

  const end = useMutation({
    mutationFn: async () => {
      stopWatch();
      const now = new Date().toISOString();
      const { error } = await supabase.from("trips").update({ status: "completed", actual_end_time: now }).eq("id", trip.id);
      if (error) throw error;
      await supabase.from("buses").update({ status: "available" }).eq("id", trip.bus_id);
      await supabase.from("drivers").update({ status: "available" }).eq("id", trip.driver_id);
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Trip completed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // compute nearest / next stop
  const currentLatLng = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  let nextStop = stops[0]?.stops ?? null;
  let nearestIdx = 0;
  if (currentLatLng && stops.length > 0) {
    let minDist = Infinity;
    stops.forEach((s, i) => {
      const d = haversine(currentLatLng, { lat: s.stops.latitude, lng: s.stops.longitude });
      if (d < minDist) { minDist = d; nearestIdx = i; }
    });
    const nextIdx = minDist < 100 ? Math.min(nearestIdx + 1, stops.length - 1) : nearestIdx;
    nextStop = stops[nextIdx]?.stops ?? null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-muted-foreground">Assigned trip</div>
            <div className="font-semibold text-lg">{trip.buses?.bus_number} — {trip.buses?.bus_name}</div>
          </div>
          <StatusBadge status={trip.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Fld label="Route">{trip.routes?.route_name}</Fld>
          <Fld label="Scheduled">{fmtTime(trip.scheduled_start_time)}</Fld>
          <Fld label="Started">{trip.actual_start_time ? fmtTime(trip.actual_start_time) : "—"}</Fld>
          <Fld label="Stops">{stops.length}</Fld>
        </div>

        <div className="mt-4 flex gap-2">
          {trip.status === "scheduled" && (
            <button onClick={() => start.mutate()} disabled={start.isPending} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <Play size={18} /> Start trip
            </button>
          )}
          {isActive && (
            <button onClick={() => { if (confirm("End trip?")) end.mutate(); }} disabled={end.isPending} className="flex-1 bg-destructive text-destructive-foreground font-medium py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <Square size={18} /> End trip
            </button>
          )}
        </div>

        {gpsError && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
            GPS: {gpsError} — please enable location permission in your browser to start the trip.
          </div>
        )}
        {isActive && !gpsError && (
          <div className="mt-3 text-xs text-muted-foreground">
            {pos ? (
              <>📍 GPS accuracy ±{Math.round(pos.coords.accuracy)}m · {relativeTime(new Date(pos.timestamp))} · Speed {pos.coords.speed != null ? `${(pos.coords.speed * 3.6).toFixed(0)} km/h` : "—"}</>
            ) : "Waiting for GPS signal…"}
          </div>
        )}
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden h-[400px]">
        <MapView
          stops={mapStops}
          polyline={polyline}
          bus={pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading ?? undefined } : null}
        />
      </div>

      {isActive && nextStop && (
        <div className="bg-card border rounded-2xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Next stop</div>
          <div className="flex items-center gap-2 font-medium"><MapPin size={16} className="text-primary" /> {nextStop.stop_name}</div>
          {currentLatLng && (
            <div className="text-xs text-muted-foreground mt-1">
              {fmtDistance(haversine(currentLatLng, { lat: nextStop.latitude, lng: nextStop.longitude }))} away
            </div>
          )}
        </div>
      )}

      <div className="bg-card border rounded-2xl p-4">
        <div className="text-xs text-muted-foreground mb-2">All stops</div>
        <ol className="space-y-1 text-sm">
          {stops.map((s, i) => (
            <li key={s.stops.id} className={`flex items-center gap-2 ${i < nearestIdx ? "text-muted-foreground line-through" : i === nearestIdx ? "font-semibold text-primary" : ""}`}>
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px]">{i + 1}</span>
              {s.stops.stop_name}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div><div className="mt-0.5">{children}</div></div>;
}
