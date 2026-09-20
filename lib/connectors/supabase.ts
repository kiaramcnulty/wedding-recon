import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public content client: no browser cookies, no session refresh, anon RLS. */
export function createConnectorSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Connector public database client is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "wedding-recon-connector-v1" } },
  });
}
