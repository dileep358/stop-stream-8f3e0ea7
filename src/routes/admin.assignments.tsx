import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Unlink, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/assignments")({ component: AssignmentsPage });

function AssignmentsPage() {
  const qc = useQueryClient();
  const [busId, setBusId] = useState("");
  const [driverId, setDriverId] = useState("");

  const { data: buses = [] } = useQuery({
    queryKey: ["buses-avail"],
    queryFn: async () => {
      const { data } = await supabase.from("buses").select("*").eq("is_active", true).neq("status", "maintenance");
      return data ?? [];
    },
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-avail"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("*").eq("is_active", true);
      return data ?? [];
    },
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bus_driver_assignments")
        .select("*, buses(bus_number,bus_name), drivers(name,phone)")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data as never[];
    },
  });

  const activeBusIds = new Set(assignments.filter((a: never) => (a as { is_active: boolean }).is_active).map((a: never) => (a as { bus_id: string }).bus_id));
  const activeDriverIds = new Set(assignments.filter((a: never) => (a as { is_active: boolean }).is_active).map((a: never) => (a as { driver_id: string }).driver_id));

  const create = useMutation({
    mutationFn: async () => {
      if (!busId || !driverId) throw new Error("Select a bus and a driver");
      const { error } = await supabase.from("bus_driver_assignments").insert({ bus_id: busId, driver_id: driverId, is_active: true });
      if (error) throw error;
      await supabase.from("buses").update({ status: "assigned" }).eq("id", busId);
      await supabase.from("drivers").update({ status: "assigned" }).eq("id", driverId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["buses-avail"] });
      qc.invalidateQueries({ queryKey: ["drivers-avail"] });
      setBusId(""); setDriverId("");
      toast.success("Assignment created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: async (a: { id: string; bus_id: string; driver_id: string }) => {
      const { error } = await supabase.from("bus_driver_assignments").update({ is_active: false, unassigned_at: new Date().toISOString() }).eq("id", a.id);
      if (error) throw error;
      await supabase.from("buses").update({ status: "available" }).eq("id", a.bus_id);
      await supabase.from("drivers").update({ status: "available" }).eq("id", a.driver_id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assignments"] }); toast.success("Unassigned"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Bus &amp; Driver Assignments</h1>
        <p className="text-muted-foreground text-sm">Assign one driver to one bus at a time.</p>
      </div>

      <div className="bg-card border rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold mb-3">Create assignment</div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs mb-1">Bus</div>
            <select value={busId} onChange={(e) => setBusId(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
              <option value="">Select bus…</option>
              {buses.filter((b: { id: string }) => !activeBusIds.has(b.id)).map((b: { id: string; bus_number: string; bus_name: string }) => (
                <option key={b.id} value={b.id}>{b.bus_number} — {b.bus_name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs mb-1">Driver</div>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
              <option value="">Select driver…</option>
              {drivers.filter((d: { id: string }) => !activeDriverIds.has(d.id)).map((d: { id: string; name: string; phone: string }) => (
                <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>
              ))}
            </select>
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !busId || !driverId} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            <Plus size={16} /> Assign
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold">Assignment history</div>
        {assignments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No assignments yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="p-3 font-medium">Bus</th><th className="p-3 font-medium">Driver</th><th className="p-3 font-medium">Assigned</th><th className="p-3 font-medium">Status</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {assignments.map((a: never) => {
                const r = a as { id: string; is_active: boolean; assigned_at: string; unassigned_at: string | null; bus_id: string; driver_id: string; buses: { bus_number: string; bus_name: string } | null; drivers: { name: string; phone: string } | null };
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3"><Link2 size={12} className="inline mr-1" />{r.buses?.bus_number} · {r.buses?.bus_name}</td>
                    <td className="p-3">{r.drivers?.name}</td>
                    <td className="p-3 text-muted-foreground">{fmtDateTime(r.assigned_at)}</td>
                    <td className="p-3">{r.is_active ? <span className="text-green-600">Active</span> : <span className="text-muted-foreground">Ended {fmtDateTime(r.unassigned_at)}</span>}</td>
                    <td className="p-3 text-right">
                      {r.is_active && (
                        <button onClick={() => { if (confirm("Unassign?")) unassign.mutate({ id: r.id, bus_id: r.bus_id, driver_id: r.driver_id }); }} className="inline-flex items-center gap-1 text-xs text-destructive hover:bg-muted px-2 py-1 rounded">
                          <Unlink size={12} /> Unassign
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
