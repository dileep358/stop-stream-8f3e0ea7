import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./admin.buses";

export const Route = createFileRoute("/admin/drivers")({ component: DriversPage });

type Driver = {
  id: string; name: string; phone: string; licence_number: string;
  licence_expiry: string | null; address: string | null;
  status: "available" | "assigned" | "on_trip" | "offline"; is_active: boolean;
};

const STATUSES = ["available", "assigned", "on_trip", "offline"] as const;

function DriversPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<Driver> | null>(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Driver[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["active-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bus_driver_assignments").select("driver_id,bus_id,buses(bus_number)").eq("is_active", true);
      if (error) throw error;
      return data as { driver_id: string; bus_id: string; buses: { bus_number: string } | null }[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Partial<Driver>) => {
      if (d.id) {
        const { id, ...rest } = d;
        const { error } = await supabase.from("drivers").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("drivers").insert(d as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["drivers"] }); setEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["drivers"] }); toast.success("Removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const m = !q || d.name.toLowerCase().includes(q) || d.phone.includes(q) || d.licence_number.toLowerCase().includes(q);
    const s = statusFilter === "all" || d.status === statusFilter;
    return m && s;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Drivers</h1>
          <p className="text-muted-foreground text-sm">{drivers.length} driver{drivers.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Add driver
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border bg-background text-sm">
          <option value="all">All</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👤</div>
            <div className="font-medium">No drivers</div>
            <div className="text-sm text-muted-foreground mt-1">Add your first driver.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium">Licence</th>
                <th className="p-3 font-medium">Assigned bus</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Active</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const assigned = assignments.find((a) => a.driver_id === d.id);
                return (
                  <tr key={d.id} className="border-t">
                    <td className="p-3 font-medium">{d.name}</td>
                    <td className="p-3 text-muted-foreground">{d.phone}</td>
                    <td className="p-3 font-mono text-xs">{d.licence_number}</td>
                    <td className="p-3">{assigned?.buses?.bus_number ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3"><StatusBadge status={d.status} /></td>
                    <td className="p-3">{d.is_active ? "Yes" : "No"}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(d)} className="p-2 hover:bg-muted rounded"><Pencil size={14} /></button>
                        <button onClick={() => { if (confirm("Remove?")) remove.mutate(d.id); }} className="p-2 hover:bg-muted rounded text-destructive"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <DriverDialog value={editing} onClose={() => setEditing(null)} onSave={(v) => save.mutate(v)} saving={save.isPending} />
      )}
    </div>
  );
}

function DriverDialog({ value, onClose, onSave, saving }: { value: Partial<Driver>; onClose: () => void; onSave: (v: Partial<Driver>) => void; saving: boolean }) {
  const [f, setF] = useState<Partial<Driver>>({
    name: "", phone: "", licence_number: "", licence_expiry: null, address: "",
    status: "available", is_active: true, ...value,
  });
  const submit = () => {
    if (!f.name || !f.phone || !f.licence_number) { toast.error("Fill required fields"); return; }
    onSave(f);
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{value.id ? "Edit" : "Add"} driver</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <F label="Name *"><input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} className="inp" /></F>
          <F label="Phone *"><input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} className="inp" /></F>
          <F label="Licence number *"><input value={f.licence_number ?? ""} onChange={(e) => setF({ ...f, licence_number: e.target.value })} className="inp" /></F>
          <F label="Licence expiry"><input type="date" value={f.licence_expiry ?? ""} onChange={(e) => setF({ ...f, licence_expiry: e.target.value })} className="inp" /></F>
          <F label="Address"><textarea value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} className="inp" rows={2} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Status">
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Driver["status"] })} className="inp">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="Active">
              <select value={f.is_active ? "yes" : "no"} onChange={(e) => setF({ ...f, is_active: e.target.value === "yes" })} className="inp">
                <option value="yes">Yes</option><option value="no">No</option>
              </select>
            </F>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
        <style>{`.inp{width:100%;padding:.5rem .75rem;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-background);font-size:.875rem}`}</style>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-xs font-medium mb-1">{label}</div>{children}</label>;
}
