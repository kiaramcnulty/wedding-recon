/**
 * Where a sign-in should land when the visitor arrived with an intent — most
 * often a vendor tapping "Verify this business" on a vendor page, which routes
 * through /portal and bounces to /login?from=/portal. Without this the login
 * always drops them on /explore and they have to find the portal by hand.
 *
 * The intent can't ride the query string all the way through: the emailed CODE
 * is verified in the browser and then hops to /auth/post-signin (server), and
 * the emailed LINK completes at /auth/callback (server) — neither sees the
 * client's `from`. So the login page stashes a validated destination in a short
 * lived cookie and both completions read it back. Same-browser only, which is
 * exactly the reach we need (an emailed link opened in another browser can't
 * sign into the PWA anyway — see components/auth/otp-code-form.tsx).
 *
 * Pure module, no server imports, so the client login page and the server auth
 * routes can all share the one validator.
 */

/** Short-lived cookie holding the validated post-sign-in destination path. */
export const POST_SIGNIN_INTENT_COOKIE = "wr_signin_to";

/**
 * Validate a candidate post-sign-in destination.
 *
 * Returns the path when it is a safe app-internal destination, else null:
 *   - must be an absolute internal path ("/…"), never protocol-relative ("//…"),
 *     which is the classic open-redirect vector;
 *   - never the landing gate ("/") or the auth plumbing ("/login", "/auth/*"),
 *     which would either bounce back through the first-visit gate or loop the
 *     freshly signed-in user straight back into the sign-in flow.
 *
 * Query strings are preserved (a "/vendor/123?x=1" return target stays intact);
 * only the pathname is checked against the disallow list.
 */
export function sanitizeSignInDestination(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split("?")[0];
  if (path === "/" || path === "/login" || path.startsWith("/auth")) return null;
  return raw;
}

/**
 * Decode a raw cookie value (percent-encoded on write) and validate it. Tolerates
 * a value that was never encoded, and never throws on a malformed one.
 */
export function readSignInDestinationCookie(
  cookieValue: string | null | undefined,
): string | null {
  if (!cookieValue) return null;
  let decoded = cookieValue;
  try {
    decoded = decodeURIComponent(cookieValue);
  } catch {
    // Fall back to the raw value — a bad decode must not throw out of sign-in.
  }
  return sanitizeSignInDestination(decoded);
}
