import { type NextRequest, type NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applyFirstVisitGate } from "@/lib/landing/first-visit";
import { legacyVendorRedirect } from "@/lib/vendors/legacy-redirect";

export async function proxy(request: NextRequest) {
  // Old /vendor/<uuid> links: a real 308 to the slug URL, before any session
  // work, since the redirect carries no page and needs no session.
  const legacy = await legacyVendorRedirect(request);
  if (legacy) return marked(legacy);

  const { response, claims } = await updateSession(request);
  // Decides between the landing page and the product at `/`, and records that a
  // visitor has reached the product. Reuses the claims updateSession already
  // verified, so recognising a signed-in visitor costs no extra auth call.
  return marked(applyFirstVisitGate(request, response, !!claims?.sub));
}

/**
 * Tags every response the proxy produced, so whether it ran is observable from
 * outside: `curl -sI` a page with and without the auth cookie and look for the
 * header. The matcher below is the most expensive thing in this file to get
 * wrong, and it fails silently in both directions.
 */
function marked(response: NextResponse): NextResponse {
  response.headers.set("x-wr-proxy", "1");
  return response;
}

/*
 * WHERE THE PROXY RUNS -- read before adding a route or an exclusion.
 *
 * The proxy is a billed function invocation on Vercel (Fluid Active CPU), and
 * a page load fans out into ~30 requests: the document, a dozen `<Link>`
 * prefetches, the PostHog `/ingest` calls. Matching all of them made one
 * anonymous Explore load 27 proxy invocations, every one a no-op (measured
 * 2026-11-14, when the Hobby allowance hit 90%; docs/notes/function-cpu.md).
 * It now runs only where it does something:
 *
 *   1. `/`, for EVERY visitor -- the first-visit gate decides landing page vs
 *      product there (lib/landing/first-visit.ts). Except `/?ref=app`, which
 *      the gate always renders as the landing page (rule 1 in
 *      firstVisitRedirect) -- and which every app page prefetches, ~5
 *      requests a page view, via the footer and profile-menu links back.
 *   2. `/vendor/<uuid>`, for EVERY visitor -- the legacy-link 308 to the slug
 *      URL (lib/vendors/legacy-redirect.ts). A slug URL is not matched here.
 *   3. Everything else, ONLY when the request carries the Supabase auth cookie
 *      (`has` below). Refreshing a session is the proxy's only job on those
 *      paths, and a browser without the cookie has no session to refresh, so
 *      for anonymous visitors and crawlers the proxy was a pure no-op.
 *
 * Why the session refresh must stay for signed-in visitors: a Server Component
 * cannot write cookies. If an access token expires and the first code to
 * notice is a Server Component (the vendor page, the Hub, the portal), the
 * refresh it triggers rotates the refresh token without persisting the new
 * one, and the next refresh with the old one can revoke the session. Running
 * the proxy first, where cookies CAN be written, is what prevents that.
 *
 * The cookie name is a literal because matcher values must be statically
 * analyzable. It is AUTH_COOKIE_NAME (lib/supabase/auth-cookie.ts), which every
 * cookie-bound client pins, and `<name>.0` covers a session split into chunks.
 * `scripts/test-proxy-matcher.mjs` fails if either literal drifts.
 *
 * Excluded even for signed-in visitors, because no session work can matter:
 * static assets; `robots.txt` / `sitemap.xml`; `ingest/` (the PostHog reverse
 * proxy in next.config.ts -- an external rewrite the CDN serves without a
 * function once the proxy is out of the way); `api/health`; and the four API
 * routes below.
 *
 * `api/vendor-photo` and `api/map/vendors` are excluded on purpose: both are
 * public, cookie-free, edge-cached endpoints, and running the session refresh
 * over them would attach a Set-Cookie that makes the response uncacheable (see
 * app/api/map/vendors/route.ts).
 *
 * `api/stripe-webhook` is excluded too: it authenticates by Stripe signature
 * over its RAW body, carries no cookies, and has no session to refresh -- the
 * middleware would only add a needless Auth round trip. `api/connectors` has
 * its own API-key authentication and deliberately uses a cookie-free anon
 * client, so session refresh must never set cookies on it.
 */
export const config = {
  matcher: [
    { source: "/", missing: [{ type: "query", key: "ref", value: "app" }] },
    "/vendor/:ref([0-9a-fA-F-]{36})",
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|ingest/|api/vendor-photo|api/map/vendors|api/stripe-webhook|api/connectors|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      has: [{ type: "cookie", key: "sb-pssxwffssopyomlzdtdo-auth-token" }],
    },
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|ingest/|api/vendor-photo|api/map/vendors|api/stripe-webhook|api/connectors|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      has: [{ type: "cookie", key: "sb-pssxwffssopyomlzdtdo-auth-token.0" }],
    },
  ],
};
