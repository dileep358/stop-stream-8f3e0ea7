import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Bus, Users } from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";

export const Route = createFileRoute("/")({
  component: Home,
});

const cards = [
  {
    to: "/admin",
    icon: Shield,
    title: "Administrator",
    desc: "Manage buses, drivers, routes, stops, assignments, and active trips.",
    color: "var(--color-admin)",
  },
  {
    to: "/driver",
    icon: Bus,
    title: "Driver",
    desc: "View assigned bus, start trips, share live location, and complete trips.",
    color: "var(--color-driver)",
  },
  {
    to: "/passenger",
    icon: Users,
    title: "Passenger",
    desc: "Search buses by boarding and destination stops and track buses live.",
    color: "var(--color-passenger)",
  },
] as const;

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-lg shrink-0">🚌</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold truncate">Smart Bus</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Live transit tracking &amp; route management</p>
          </div>
          <InstallAppButton className="hidden sm:inline-flex" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Choose your role</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-sm sm:text-base px-2">
            A complete platform for administrators, drivers, and passengers — with live GPS tracking and real-time trip monitoring.
          </p>
          <div className="mt-6 flex justify-center sm:hidden">
            <InstallAppButton />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group relative bg-card border rounded-2xl p-5 sm:p-7 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 active:scale-[0.99]"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-4 sm:mb-5 text-white" style={{ backgroundColor: c.color }}>
                <c.icon size={26} />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              <div className="mt-5 sm:mt-6 text-sm font-medium text-primary sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Open dashboard →
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t mt-10 sm:mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted-foreground text-center">
          Smart Bus — powered by OpenStreetMap &amp; realtime GPS
        </div>
      </footer>
    </div>
  );
}
