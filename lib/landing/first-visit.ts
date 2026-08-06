import { NextResponse, type NextRequest } from "next/server";

import {
  APP_HREF,
  LANDING_REF_APP,
  LANDING_REF_PARAM,
  VISIT_COOKIE,
  VISIT_COOKIE_MAX_AGE,
  isProductPath,
} from "./nav";

/**
 * Routes `/` by whether the visitor has used the product before.
 *
 * - First-time (and crawler) visitors get the landing page at `/`.
 * - Anyone who has reached a product path before — or is signed in — is sent
 *   straight to Explore, so the pitch is shown exactly once.
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
  const seen = request.cookies.get(VISIT_COOKIE)?.value === "1";

  // Reaching the product is what marks someone as a returning visitor.
  if (isProductPath(pathname)) {
    if (!seen) {
      response.cookies.set(VISIT_COOKIE, "1", {
        maxAge: VISIT_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  }

  if (pathname !== "/") return response;
  if (searchParams.get(LANDING_REF_PARAM) === LANDING_REF_APP) return response;
  if (!seen && !signedIn) return response;

  const url = request.nextUrl.clone();
  url.pathname = APP_HREF;

  // NextResponse.redirect() starts from a blank response, so anything
  // updateSession() just wrote — a refreshed Supabase access/refresh token pair
  // — has to be copied across or the session silently fails to persist.
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
