
-- Enums
CREATE TYPE bus_status AS ENUM ('available','assigned','running','offline','maintenance');
CREATE TYPE driver_status AS ENUM ('available','assigned','on_trip','offline');
CREATE TYPE trip_status AS ENUM ('scheduled','active','delayed','completed','cancelled');

-- Buses
CREATE TABLE public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number TEXT NOT NULL UNIQUE,
  registration_number TEXT NOT NULL,
  bus_name TEXT NOT NULL,
  bus_type TEXT,
  capacity INT NOT NULL DEFAULT 40,
  status bus_status NOT NULL DEFAULT 'available',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buses TO anon, authenticated;
GRANT ALL ON public.buses TO service_role;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public buses" ON public.buses FOR ALL USING (true) WITH CHECK (true);

-- Drivers
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  licence_number TEXT NOT NULL,
  licence_expiry DATE,
  address TEXT,
  status driver_status NOT NULL DEFAULT 'available',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO anon, authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public drivers" ON public.drivers FOR ALL USING (true) WITH CHECK (true);

-- Stops
CREATE TABLE public.stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stops TO anon, authenticated;
GRANT ALL ON public.stops TO service_role;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public stops" ON public.stops FOR ALL USING (true) WITH CHECK (true);

-- Routes
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  start_stop_id UUID REFERENCES public.stops(id) ON DELETE SET NULL,
  end_stop_id UUID REFERENCES public.stops(id) ON DELETE SET NULL,
  total_distance DOUBLE PRECISION,
  estimated_duration INT,
  route_geometry JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO anon, authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public routes" ON public.routes FOR ALL USING (true) WITH CHECK (true);

-- Route stops
CREATE TABLE public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  stop_order INT NOT NULL,
  expected_arrival_offset INT,
  distance_from_route_start DOUBLE PRECISION,
  UNIQUE (route_id, stop_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO anon, authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public route_stops" ON public.route_stops FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_route_stops_route ON public.route_stops(route_id, stop_order);

-- Assignments
CREATE TABLE public.bus_driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_driver_assignments TO anon, authenticated;
GRANT ALL ON public.bus_driver_assignments TO service_role;
ALTER TABLE public.bus_driver_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public assignments" ON public.bus_driver_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX idx_active_bus ON public.bus_driver_assignments(bus_id) WHERE is_active;
CREATE UNIQUE INDEX idx_active_driver ON public.bus_driver_assignments(driver_id) WHERE is_active;

-- Trips
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id),
  bus_id UUID NOT NULL REFERENCES public.buses(id),
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  expected_end_time TIMESTAMPTZ,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  status trip_status NOT NULL DEFAULT 'scheduled',
  delay_minutes INT DEFAULT 0,
  current_stop_id UUID REFERENCES public.stops(id),
  next_stop_id UUID REFERENCES public.stops(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO anon, authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_trips_route ON public.trips(route_id);
CREATE INDEX idx_trips_driver ON public.trips(driver_id);
CREATE INDEX idx_trips_bus ON public.trips(bus_id);

-- Driver locations
CREATE TABLE public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  bus_id UUID NOT NULL REFERENCES public.buses(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO anon, authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public locations" ON public.driver_locations FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_dl_trip ON public.driver_locations(trip_id, recorded_at DESC);
CREATE INDEX idx_dl_recorded ON public.driver_locations(recorded_at DESC);

-- Trip stop status
CREATE TABLE public.trip_stop_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES public.stops(id),
  stop_order INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expected_arrival_time TIMESTAMPTZ,
  actual_arrival_time TIMESTAMPTZ,
  UNIQUE(trip_id, stop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_stop_status TO anon, authenticated;
GRANT ALL ON public.trip_stop_status TO service_role;
ALTER TABLE public.trip_stop_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public tss" ON public.trip_stop_status FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_buses_updated BEFORE UPDATE ON public.buses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_routes_updated BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
