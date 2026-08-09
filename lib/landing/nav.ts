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
 * Which screens count as "has used the product" is now decided by where
 * <MarkVisited> is mounted: the `(app)` layout, covering explore, hub, add,
 * vendor and recon. `/terms` is deliberately outside it - it is linked from the
 * landing footer, and reading the disclaimer should not suppress the pitch. The
 * `(auth)` screens are outside it too: visiting a login form is not using the
 * product, and anyone who completes it is recognised by the signed-in check
 * instead.
 */
