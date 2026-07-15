import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "./admin.buses";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/trips")({ component: TripsPage });

function TripsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: trips = [] } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips")
        .select("*, routes(route_name), buses(bus_number,bus_name), drivers(name)")
        .order("scheduled_start_time", { ascending: false });
      if (error) throw error;
      return data as never[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("trips").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success("Removed"); },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Trips</h1>
          <p className="text-muted-foreground text-sm">Schedule and monitor trips.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> New trip
        </button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {trips.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🕒</div>
            <div className="font-medium">No trips scheduled</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Route</th>
                <th className="p-3 font-medium">Bus</th>
                <th className="p-3 font-medium">Driver</th>
                <th className="p-3 font-medium">Scheduled</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t: never) => {
                const r = t as { id: string; status: string; scheduled_start_time: string; routes: { route_name: string } | null; buses: { bus_number: string; bus_name: string } | null; drivers: { name: string } | null };
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.routes?.route_name}</td>
                    <td className="p-3">{r.buses?.bus_number}</td>
                    <td className="p-3">{r.drivers?.name}</td>
                    <td className="p-3 text-muted-foreground">{fmtDateTime(r.scheduled_start_time)}</td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                    <td className="p-3 text-right">
                      <button onClick={() => { if (confirm("Delete trip?")) del.mutate(r.id); }} className="p-2 hover:bg-muted rounded text-destructive"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {creating && <NewTripDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewTripDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [routeId, setRouteId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 30 * 60000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [endWhen, setEndWhen] = useState("");

  const { data: routes = [] } = useQuery({
    queryKey: ["routes-active"],
    queryFn: async () => (await supabase.from("routes").select("id,route_name").eq("is_active", true)).data ?? [],
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments-active"],
    queryFn: async () => (await supabase.from("bus_driver_assignments").select("id,bus_id,driver_id,buses(bus_number,bus_name),drivers(name)").eq("is_active", true)).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!routeId || !assignmentId || !when) throw new Error("Fill all required fields");
      const a = (assignments as never[]).find((x) => (x as { id: string }).id === assignmentId) as { bus_id: string; driver_id: string } | undefined;
      if (!a) throw new Error("Invalid assignment");
      const { error } = await supabase.from("trips").insert({
        route_id: routeId, bus_id: a.bus_id, driver_id: a.driver_id,
        scheduled_start_time: new Date(when).toISOString(),
        expected_end_time: endWhen ? new Date(endWhen).toISOString() : null,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success("Trip scheduled"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">New trip</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs font-medium mb-1">Route *</div>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="inp">
              <option value="">Select route…</option>
              {(routes as never[]).map((r) => { const x = r as { id: string; route_name: string }; return <option key={x.id} value={x.id}>{x.route_name}</option>; })}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1">Bus &amp; Driver (active assignment) *</div>
            <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} className="inp">
              <option value="">Select assignment…</option>
              {(assignments as never[]).map((r) => { const x = r as { id: string; buses: { bus_number: string } | null; drivers: { name: string } | null }; return <option key={x.id} value={x.id}>{x.buses?.bus_number} — {x.drivers?.name}</option>; })}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1">Scheduled start *</div>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="inp" />
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1">Expected end</div>
            <input type="datetime-local" value={endWhen} onChange={(e) => setEndWhen(e.target.value)} className="inp" />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted">Cancel</button>
          <button onClick={() => create.mutate()} disabled={create.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{create.isPending ? "Creating…" : "Create"}</button>
        </div>
        <style>{`.inp{width:100%;padding:.5rem .75rem;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-background);font-size:.875rem}`}</style>
      </div>
    </div>
  );
}
