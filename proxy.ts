import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applyFirstVisitGate } from "@/lib/landing/first-visit";

export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  // Decides between the landing page and the product at `/`, and records that a
  // visitor has reached the product. Reuses the claims updateSession already
  // verified, so recognising a signed-in visitor costs no extra auth call.
  return applyFirstVisitGate(request, response, !!claims?.sub);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files so the auth
     * session stays fresh on navigations and API calls.
     *
     * `api/vendor-photo` and `api/map/vendors` are excluded on purpose: both are
     * public, cookie-free, edge-cached endpoints, and running the session
     * refresh over them would attach a Set-Cookie that makes the response
     * uncacheable (see app/api/map/vendors/route.ts).
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/vendor-photo|api/map/vendors|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
