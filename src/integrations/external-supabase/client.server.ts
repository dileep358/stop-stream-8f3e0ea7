// Server-only client for the SECOND (external) Supabase database.
// Never import this from client-reachable module scope. Import inside
// createServerFn `.handler()` bodies with `await import(...)`.
//
// Two clients:
//  - externalSupabase        → uses anon key (RLS applies)
//  - externalSupabaseAdmin   → uses service_role key (BYPASSES RLS)
//
// This targets a completely separate Supabase project from Lovable Cloud.
// Use it explicitly when you want data to live in your own Supabase.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let _anon: SupabaseClient | null = null;
let _admin: SupabaseClient | null = null;

export function getExternalSupabase(): SupabaseClient {
  if (_anon) return _anon;
  const url = requireEnv("EXTERNAL_SUPABASE_URL");
  const key = requireEnv("EXTERNAL_SUPABASE_ANON_KEY");
  _anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _anon;
}

export function getExternalSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = requireEnv("EXTERNAL_SUPABASE_URL");
  const key = requireEnv("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
