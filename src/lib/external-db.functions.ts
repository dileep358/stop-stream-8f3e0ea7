// Example server functions that read/write against your OWN Supabase
// (the second database). Import these from components/routes; they run
// server-side and forward to the external project.
//
// Add more thin wrappers here as you need them. Keep the admin client
// imported INSIDE each handler to avoid leaking server-only modules
// into the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const externalPing = createServerFn({ method: "GET" }).handler(async () => {
  const { getExternalSupabaseAdmin } = await import(
    "@/integrations/external-supabase/client.server"
  );
  const supabase = getExternalSupabaseAdmin();
  // Simple connectivity check — lists first row from information_schema via RPC-less call.
  const { error } = await supabase.from("_healthcheck_noop").select("*").limit(1);
  // We don't care if the table doesn't exist; if the network / auth is bad
  // the error code will be different (e.g. invalid JWT / fetch failed).
  return {
    ok: !error || error.code === "42P01" || error.code === "PGRST205",
    error: error ? { code: error.code, message: error.message } : null,
  };
});

export const externalSelect = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        table: z.string().min(1),
        columns: z.string().default("*"),
        limit: z.number().int().positive().max(1000).default(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getExternalSupabaseAdmin } = await import(
      "@/integrations/external-supabase/client.server"
    );
    const supabase = getExternalSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from(data.table)
      .select(data.columns)
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const externalInsert = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        table: z.string().min(1),
        values: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getExternalSupabaseAdmin } = await import(
      "@/integrations/external-supabase/client.server"
    );
    const supabase = getExternalSupabaseAdmin();
    const { data: row, error } = await supabase
      .from(data.table)
      .insert(data.values)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { row };
  });
