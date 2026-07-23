import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Bus, User, MapPin, Link2, CalendarClock, Radio, Home, LogOut, Lock } from "lucide-react";
import { useState, useEffect } from "react";

const ADMIN_EMAIL = "admin@admin2026";
const ADMIN_PASSWORD = "admin2026";
const ADMIN_SESSION_KEY = "smartbus_admin_session";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
});

function AdminGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    setAuthed(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
  }, []);
  if (authed === null) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;
  return <AdminLayout onLogout={() => { sessionStorage.removeItem(ADMIN_SESSION_KEY); setAuthed(false); }} />;
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTimeout(() => {
      if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
        onSuccess();
      } else {
        setError("Invalid email or password");
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-3">
            <Lock size={20} />
          </div>
          <h1 className="text-xl font-bold">Administrator Login</h1>
          <p className="text-xs text-muted-foreground mt-1">Sign in to open the admin dashboard</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Email</label>
            <input type="email" autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@admin2026"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Password</label>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
          </div>
          {error && <div className="text-xs text-destructive">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link to="/" className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Home size={12} /> Back to home
        </Link>
      </div>
    </div>
  );
}

const nav: { to: string; label: string; icon: typeof Bus; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/buses", label: "Buses", icon: Bus },
  { to: "/admin/drivers", label: "Drivers", icon: User },
  { to: "/admin/routes", label: "Routes & Stops", icon: MapPin },
  { to: "/admin/assignments", label: "Assignments", icon: Link2 },
  { to: "/admin/trips", label: "Trips", icon: CalendarClock },
  { to: "/admin/monitor", label: "Live Monitor", icon: Radio },
];

function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r bg-card hidden md:flex flex-col">
        <div className="p-5 border-b">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm">🚌</div>
            <div>
              <div className="text-sm font-bold leading-none">Smart Bus</div>
              <div className="text-[10px] text-muted-foreground mt-1">Admin</div>
            </div>
          </Link>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <n.icon size={16} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-1">
          <button onClick={onLogout} className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted">
            <LogOut size={14} /> Sign out
          </button>
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2">
            <Home size={14} /> Back to home
          </Link>
        </div>
      </aside>


      {/* Mobile top nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 flex overflow-x-auto">
        {nav.map((n) => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex-1 min-w-[64px] py-2 flex flex-col items-center gap-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              <n.icon size={16} />
              {n.label.split(" ")[0]}
            </Link>
          );
        })}
      </div>

      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
