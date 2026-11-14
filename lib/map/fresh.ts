/**
 * "This browser just changed something the map shows."
 *
 * `/api/map/vendors` is CDN-cached for an hour (the CPU budget is why; see the
 * route). Every visitor sharing one copy is the point, but it means a couple
 * who has just added a vendor or a recon entry could go back to Explore and not
 * see it. So a write sets this short-lived cookie (server side, see
 * `fresh-server.ts`), and while it lives this browser's map requests carry
 * `fresh=<token>`. The CDN keys on the full URL, so that is a separate cache
 * entry: the author gets current rows, everyone else keeps sharing the cached
 * ones, and the route itself ignores the parameter.
 *
 * Lifetime matches the route's `s-maxage`: once the cookie expires, the shared
 * copy has been refreshed past the write.
 */
export const MAP_FRESH_COOKIE = "wr_map_fresh";
export const MAP_FRESH_MAX_AGE_S = 3600;

/** Client side: the token to send with map requests, or null for the shared copy. */
export function mapFreshToken(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === MAP_FRESH_COOKIE) return rest.join("=") || null;
  }
  return null;
}
