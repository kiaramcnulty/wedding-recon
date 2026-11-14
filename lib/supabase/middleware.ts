import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "./auth-cookie";

/**
 * Refreshes the Supabase auth session on each request and keeps cookies in sync.
 * Call from the root middleware. Does NOT gate routes — public vendor pages and
 * shared deeplinks must remain readable without an account.
 *
 * Returns the verified claims alongside the response so a caller can tell
 * signed-in from anonymous without paying for a second auth call (the
 * first-visit gate uses it to skip the landing page for account holders).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // The name the proxy matcher keys on; see lib/supabase/auth-cookie.ts.
      cookieOptions: { name: AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verify the JWT (locally when the project uses asymmetric signing keys) and
  // refresh the session when it's near expiry. Replaces getUser(), which made
  // a network round trip to Supabase Auth on every navigation.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
