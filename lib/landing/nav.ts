/**
 * Constants shared by the first-visit gate (middleware) and by app UI that
 * links back to the landing page.
 *
 * Deliberately free of `next/server` imports so a Client Component (e.g.
 * ProfileMenu) can import LANDING_HREF without dragging the server runtime into
 * its bundle. The NextResponse half lives in `./first-visit`.
 */

/**
 * Marks a visitor as having reached the product itself. Set by the middleware
 * on any product path; its presence is what sends a later visit to `/`
 * straight through to Explore instead of the landing page.
 *
 * httpOnly — nothing on the client reads it, and keeping it off `document.cookie`
 * means a third-party script can't accidentally clear someone's "seen" state.
 */
export const VISIT_COOKIE = "wr_seen";

/** One year. Long enough that a couple planning over a season isn't re-pitched. */
export const VISIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Query marker meaning "show me the landing page even though I've been here."
 * Without it, every in-app link back to `/` would be bounced straight to
 * Explore by the gate — the visitor can never reach the page they asked for.
 */
export const LANDING_REF_PARAM = "ref";
export const LANDING_REF_APP = "app";

/** The href app surfaces use to reach the landing page. Always renders it. */
export const LANDING_HREF = `/?${LANDING_REF_PARAM}=${LANDING_REF_APP}`;

/** Where the landing page's CTAs send people, and where the gate redirects. */
export const APP_HREF = "/explore";

/**
 * Path prefixes that count as "has used the product". Reaching any of them is
 * what sets VISIT_COOKIE.
 *
 * `/terms` is deliberately absent — it's linked from the landing page footer,
 * so treating it as a product visit would suppress the landing page for someone
 * who only ever read the disclaimer. `/vendor` and `/recon` are present because
 * a shared deeplink is a real first contact with the product: someone who
 * landed on a vendor page from a friend's text has seen what this is.
 */
const PRODUCT_PREFIXES = [
  "/explore",
  "/hub",
  "/add",
  "/vendor",
  "/recon",
  "/login",
  "/onboarding",
] as const;

export function isProductPath(pathname: string): boolean {
  return PRODUCT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}
