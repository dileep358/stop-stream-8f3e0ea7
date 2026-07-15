import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Bus, User, MapPin, Link2, CalendarClock, Radio, Home } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/buses", label: "Buses", icon: Bus },
  { to: "/admin/drivers", label: "Drivers", icon: User },
  { to: "/admin/routes", label: "Routes & Stops", icon: MapPin },
  { to: "/admin/assignments", label: "Assignments", icon: Link2 },
  { to: "/admin/trips", label: "Trips", icon: CalendarClock },
  { to: "/admin/monitor", label: "Live Monitor", icon: Radio },
] as const;

function AdminLayout() {
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
        <div className="p-3 border-t">
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
