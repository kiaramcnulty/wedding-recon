import { NextResponse, type NextRequest } from "next/server";

import {
  LANDING_REF_PARAM,
  VENDOR_COOKIE,
  VISIT_COOKIE,
  firstVisitRedirect,
} from "./nav";

/**
 * Routes `/` by whether the visitor has used the product before.
 *
 * - First-time (and crawler) visitors get the landing page at `/`.
 * - A business-side browser (it has reached the vendor portal) is sent to the
 *   portal, so a vendor never lands on the couples product.
 * - Anyone else who has reached a product path before — or is signed in — is
 *   sent straight to Explore, so the pitch is shown exactly once.
 * - `/?ref=app` always renders the landing page (see LANDING_HREF): it's how
 *   the in-app links back reach a page the gate would otherwise redirect away
 *   from.
 *
 * Runs in the middleware rather than in the page so `/` itself stays statically
 * renderable — reading cookies in a Server Component would opt the whole route
 * out of static generation, which is the last thing a marketing page wants.
 * It also means the decision happens before the CDN cache is consulted.
 */
export function applyFirstVisitGate(
  request: NextRequest,
  response: NextResponse,
  signedIn: boolean,
): NextResponse {
  const { pathname, searchParams } = request.nextUrl;

  // Only `/` is decided here. Both cookies are written client-side - by
  // <MarkVisited> in the (app) layout and <MarkVendor> on the portal
  // dashboard: a Next prefetch of a product link is a real request but not a
  // real visit, and the header that would identify one is not visible to the
  // proxy. See components/mark-visited.tsx.
  if (pathname !== "/") return response;

  // The rule itself lives in nav.ts (pure, unit-tested); this is the plumbing.
  const destination = firstVisitRedirect({
    pathname,
    ref: searchParams.get(LANDING_REF_PARAM),
    seen: request.cookies.get(VISIT_COOKIE)?.value === "1",
    vendor: request.cookies.get(VENDOR_COOKIE)?.value === "1",
    signedIn,
  });
  if (!destination) return response;

  const url = request.nextUrl.clone();
  url.pathname = destination;

  // NextResponse.redirect() starts from a blank response, so anything
  // updateSession() just wrote — a refreshed Supabase access/refresh token pair
  // — has to be copied across or the session silently fails to persist.
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
