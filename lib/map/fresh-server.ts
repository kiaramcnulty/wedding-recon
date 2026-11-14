import { cookies } from "next/headers";

import { MAP_FRESH_COOKIE, MAP_FRESH_MAX_AGE_S } from "./fresh";

/**
 * Server Actions: mark this browser's map as needing current rows for the next
 * hour, after a write the map shows (a new vendor, a recon count, a listing).
 * See `lib/map/fresh.ts`. Never throws: a failed marker costs one stale map
 * load, which must not fail the write that already succeeded.
 */
export async function markMapFresh(): Promise<void> {
  try {
    (await cookies()).set(MAP_FRESH_COOKIE, Date.now().toString(36), {
      maxAge: MAP_FRESH_MAX_AGE_S,
      path: "/",
      sameSite: "lax",
      // Read by the map's client code, and it holds nothing secret.
      httpOnly: false,
    });
  } catch {
    // Not in a request scope that can write cookies; skip.
  }
}
