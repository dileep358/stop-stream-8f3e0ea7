
-- 1) Driver security columns
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS login_name TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Backfill login_name from name for existing rows
UPDATE public.drivers
SET login_name = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '.', 'g')) || '.' || substr(id::text, 1, 4)
WHERE login_name IS NULL;

ALTER TABLE public.drivers ALTER COLUMN login_name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_login_name ON public.drivers(lower(login_name));

-- Revoke direct writes on drivers from anon/authenticated so PIN cannot be tampered from the client.
-- Server functions use service_role via supabaseAdmin.
REVOKE INSERT, UPDATE, DELETE ON public.drivers FROM anon, authenticated;
-- SELECT stays granted so admin & passenger UI can still list drivers; pin_hash is a text column
-- but we'll never select it from client code. Add a policy limiting non-service reads to safe columns
-- is not possible per-column via RLS, so rely on convention + code review + column-less selects.

-- 2) Driver sessions
CREATE TABLE IF NOT EXISTS public.driver_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_sessions TO authenticated;
GRANT ALL ON public.driver_sessions TO service_role;
ALTER TABLE public.driver_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages sessions" ON public.driver_sessions FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver ON public.driver_sessions(driver_id);

-- 3) Login attempts audit log
CREATE TABLE IF NOT EXISTS public.driver_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  attempted_login_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_login_attempts TO authenticated;
GRANT ALL ON public.driver_login_attempts TO service_role;
ALTER TABLE public.driver_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manages login attempts" ON public.driver_login_attempts FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON public.driver_login_attempts(attempted_at DESC);

-- 4) App versions
CREATE TABLE IF NOT EXISTS public.app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'android',
  version_name TEXT NOT NULL,
  version_code INT NOT NULL,
  download_url TEXT,
  release_notes TEXT,
  mandatory BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_versions TO anon, authenticated;
GRANT ALL ON public.app_versions TO service_role;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read app versions" ON public.app_versions FOR SELECT USING (is_active);
CREATE POLICY "service writes app versions" ON public.app_versions FOR ALL USING (false) WITH CHECK (false);
