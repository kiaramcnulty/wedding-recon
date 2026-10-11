/**
 * Constants shared by the first-visit gate (middleware) and by app UI that
 * links back to the landing page.
 *
 * Deliberately free of `next/server` imports so a Client Component (e.g.
 * ProfileMenu) can import LANDING_HREF without dragging the server runtime into
 * its bundle. The NextResponse half lives in `./first-visit`.
 */

/**
 * Marks a visitor as having reached the product itself. Its presence is what
 * sends a later visit to `/` straight through to Explore instead of the landing
 * page.
 *
 * Written client-side by <MarkVisited> in the (app) layout, so it cannot be
 * httpOnly. It holds no secret, and a prefetch cannot set it - which is the
 * whole point. See components/mark-visited.tsx for why the middleware stopped
 * writing it.
 */
export const VISIT_COOKIE = "wr_seen";

/**
 * 30 days, written ONCE (MarkVisited skips the write when the cookie is
 * present), so it lapses 30 days after the first product visit even for a
 * visitor who keeps using the app signed out - and they see the landing page
 * once more. Accepted on purpose (Kiara, 2026-10-11): it was one year, and the
 * cookies that steer `/` now share a 30-day lifetime. A signed-in visitor is
 * unaffected, since the gate recognises them without the cookie.
 */
export const VISIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Marks this browser as BUSINESS-side: someone who has reached the vendor
 * portal signed in (any step - claiming, drafting, paying, or already
 * verified). Its presence sends a later visit to `/` to the portal instead of
 * Explore, so a vendor who comes back to finish verifying, or to manage a live
 * listing, is not dropped on the couples product.
 *
 * Written client-side by <MarkVendor> on the portal dashboard, for the same
 * prefetch reason as VISIT_COOKIE (the profile menu prefetches /portal on every
 * app screen). Never written for site admins. Cleared only by the "Not a
 * vendor?" link on the portal, or by expiring.
 */
export const VENDOR_COOKIE = "wr_vendor";

/** 30 days, RENEWED on every portal dashboard render, so it lapses only after 30 days away. */
export const VENDOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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

/** Where the gate sends a business-side browser (VENDOR_COOKIE). */
export const PORTAL_HREF = "/portal";

/**
 * Where a request for `/` should be redirected, or null to render the landing
 * page. Pure (no Next imports) so the routing rule is testable on its own -
 * see scripts/test-first-visit-gate.mjs. In order:
 *
 *   1. `/?ref=app`            -> landing (the in-app links back to it)
 *   2. business-side browser  -> the portal
 *   3. signed in, or has used the product -> Explore
 *   4. otherwise              -> landing
 *
 * The portal decides the rest: signed in, it resumes the dashboard; signed
 * out, it redirects to the /for-vendors pitch (which has the sign-in link).
 */
export function firstVisitRedirect(input: {
  pathname: string;
  ref: string | null;
  seen: boolean;
  vendor: boolean;
  signedIn: boolean;
}): string | null {
  if (input.pathname !== "/") return null;
  if (input.ref === LANDING_REF_APP) return null;
  if (input.vendor) return PORTAL_HREF;
  if (input.seen || input.signedIn) return APP_HREF;
  return null;
}

/**
 * Which screens count as "has used the product" is now decided by where
 * <MarkVisited> is mounted: the `(app)` layout, covering explore, hub, add,
 * vendor and recon. `/terms` is deliberately outside it - it is linked from the
 * landing footer, and reading the disclaimer should not suppress the pitch. The
 * `(auth)` screens are outside it too: visiting a login form is not using the
 * product, and anyone who completes it is recognised by the signed-in check
 * instead.
 */
