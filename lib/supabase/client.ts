import { createBrowserClient } from "@supabase/ssr";

import { AUTH_COOKIE_NAME } from "./auth-cookie";

/** Supabase client for use in Client Components (browser). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Pinned so proxy.ts can match on it; see lib/supabase/auth-cookie.ts.
    { cookieOptions: { name: AUTH_COOKIE_NAME } },
  );
}
