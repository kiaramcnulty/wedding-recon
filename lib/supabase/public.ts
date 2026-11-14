import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-free anon Supabase client for server renders that must stay CACHEABLE.
 *
 * `createClient()` in `./server.ts` reads the request cookies, and reading
 * cookies is a Request-time API: one call anywhere in a render makes the whole
 * route dynamic, so it renders (and is billed) on every request. The vendor
 * page is ISR (`app/(app)/vendor/[id]/page.tsx`), and this is what lets it read
 * the database without knowing who is asking. It sees exactly what a
 * signed-out visitor sees under RLS, which is what a cached page may show.
 *
 * Never use it for anything viewer-specific or for a write: there is no
 * session here, by design.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
