import { useEffect, useRef } from "react";
import L from "leaflet";

// Fix default marker icons for Leaflet with bundlers.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface MapStop { id: string; name: string; lat: number; lng: number; kind?: "start" | "end" | "stop" | "bus" | "user" }

interface Props {
  center?: [number, number];
  zoom?: number;
  stops?: MapStop[];
  polyline?: [number, number][];
  bus?: { lat: number; lng: number; heading?: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDrag?: (id: string, lat: number, lng: number) => void;
  className?: string;
  fitBounds?: boolean;
}

const colorFor = (kind?: string) => {
  switch (kind) {
    case "start": return "#16a34a";
    case "end": return "#dc2626";
    case "bus": return "#2563eb";
    case "user": return "#a855f7";
    default: return "#0ea5e9";
  }
};

const makeIcon = (kind?: string, label?: string) => L.divIcon({
  className: "",
  html: `<div style="background:${colorFor(kind)};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;">${label ?? ""}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function MapView({
  center = [20.5937, 78.9629],
  zoom = 5,
  stops = [],
  polyline,
  bus,
  onMapClick,
  onMarkerDrag,
  className,
  fitBounds = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const clickHandlerRef = useRef(onMapClick);
  clickHandlerRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center, zoom, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    map.on("click", (e) => clickHandlerRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw stops + polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const l of layersRef.current) map.removeLayer(l);
    layersRef.current = [];

    if (polyline && polyline.length > 1) {
      const line = L.polyline(polyline, { color: "#2563eb", weight: 5, opacity: 0.75 }).addTo(map);
      layersRef.current.push(line);
    }

    stops.forEach((s, i) => {
      const label = s.kind === "start" ? "A" : s.kind === "end" ? "B" : String(i);
      const m = L.marker([s.lat, s.lng], {
        icon: makeIcon(s.kind, label),
        draggable: !!onMarkerDrag,
      }).addTo(map);
      m.bindTooltip(s.name);
      if (onMarkerDrag) {
        m.on("dragend", () => {
          const ll = m.getLatLng();
          onMarkerDrag(s.id, ll.lat, ll.lng);
        });
      }
      layersRef.current.push(m);
    });

    if (fitBounds) {
      const pts: [number, number][] = [
        ...stops.map((s) => [s.lat, s.lng] as [number, number]),
        ...(polyline ?? []),
      ];
      if (bus) pts.push([bus.lat, bus.lng]);
      if (pts.length > 0) {
        const b = L.latLngBounds(pts);
        map.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
      }
    }
  }, [stops, polyline, fitBounds, onMarkerDrag, bus]);

  // Smoothly move bus marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!bus) {
      if (busMarkerRef.current) {
        map.removeLayer(busMarkerRef.current);
        busMarkerRef.current = null;
      }
      return;
    }
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#2563eb;width:34px;height:34px;border-radius:50%;border:4px solid white;box-shadow:0 3px 10px rgba(37,99,235,.55);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;transform:rotate(${bus.heading ?? 0}deg);">🚌</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    if (!busMarkerRef.current) {
      busMarkerRef.current = L.marker([bus.lat, bus.lng], { icon }).addTo(map);
    } else {
      busMarkerRef.current.setIcon(icon);
      // simple animation
      const from = busMarkerRef.current.getLatLng();
      const to = L.latLng(bus.lat, bus.lng);
      const steps = 20;
      let i = 0;
      const dLat = (to.lat - from.lat) / steps;
      const dLng = (to.lng - from.lng) / steps;
      const marker = busMarkerRef.current;
      const iv = setInterval(() => {
        i++;
        marker.setLatLng([from.lat + dLat * i, from.lng + dLng * i]);
        if (i >= steps) clearInterval(iv);
      }, 30);
    }
  }, [bus]);

  return <div ref={containerRef} className={className ?? "w-full h-full min-h-[400px] rounded-lg overflow-hidden"} />;
}
