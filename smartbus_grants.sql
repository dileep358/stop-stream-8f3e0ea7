-- Run ONCE in your Supabase SQL editor
-- (Project: bjkfpjuofefeeaeblbmc)
--
-- Fixes:
--  1. "permission denied for table ..." errors when the driver/admin/passenger UI
--     tries to update trip/bus/driver status or insert GPS points.
--  2. Passenger + Admin live map staying empty because Realtime is not
--     publishing driver_locations / trips / trip_stop_status.
--
-- Safe to re-run.

-- ---------- Grants for the browser (anon) role ----------
grant usage on schema public to anon;

-- read everything the passenger + admin views need
grant select on
  public.buses,
  public.drivers,
  public.routes,
  public.stops,
  public.route_stops,
  public.bus_driver_assignments,
  public.trips,
  public.driver_locations,
  public.trip_stop_status,
  public.app_versions
to anon;

-- writes the app performs from the browser (all still protected by RLS)
grant insert, update on public.buses                  to anon;
grant insert, update, delete on public.routes         to anon;
grant insert, update, delete on public.stops          to anon;
grant insert, update, delete on public.route_stops    to anon;
grant insert, update, delete on public.bus_driver_assignments to anon;
grant insert, update, delete on public.trips          to anon;
grant insert, update on public.drivers                to anon;
grant insert on public.driver_locations               to anon;
grant insert, update on public.trip_stop_status       to anon;

-- ---------- Realtime (needed for the live bus marker) ----------
alter publication supabase_realtime add table public.driver_locations;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.trip_stop_status;
