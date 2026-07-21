// Browser Supabase client for the external (user-owned) Supabase project.
// The anon/publishable key is safe to expose in client code.
import { createClient } from "@supabase/supabase-js";

const EXTERNAL_SUPABASE_URL = "https://bjkfpjuofefeeaeblbmc.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqa2ZwanVvZmVmZWVhZWJsYm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNDgyODAsImV4cCI6MjA5OTgyNDI4MH0.F17JUWlGi0iYGocZmdPksPWL20zejnhTJ4xcwheXMFE";

export const supabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
