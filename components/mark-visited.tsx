"use client";

import { useEffect } from "react";

import { VISIT_COOKIE, VISIT_COOKIE_MAX_AGE } from "@/lib/landing/nav";

/**
 * Records that this visitor has actually used the product, which is what sends
 * a later visit to `/` straight to Explore instead of the landing page.
 *
 * Rendered once in the `(app)` layout, so it covers every product screen -
 * explore, hub, add, vendor, recon - and nothing else.
 *
 * WHY THIS IS CLIENT-SIDE, not a Set-Cookie from the middleware, which is what
 * it used to be (fixed 2026-08-04):
 *
 * Next prefetches every `<Link>` that scrolls into view. The landing page links
 * to /explore, /hub and /add, so merely READING the landing page fired requests
 * to all three - and the middleware, seeing a request to a product path, set
 * the cookie. The visitor was then bounced to Explore the next time they opened
 * `/`, having never once chosen to go there.
 *
 * The header that identifies a prefetch (`next-router-prefetch`) is not
 * available to the proxy: Next strips it, and the proxy sees only accept, host,
 * user-agent and the forwarded set. `accept` does separate a document load,
 * which asks for text/html, from a prefetch, which asks for anything - but a
 * client-side navigation asks for anything too, so keying on it would miss the
 * visitor who clicks the hero CTA, the single most likely way anyone reaches
 * the product.
 *
 * An effect runs only when React actually renders the page. A prefetch fetches
 * the payload and renders nothing, so it cannot trigger this; a real load and a
 * client-side navigation both can. That is exactly the line we want.
 *
 * The trade: the cookie can no longer be httpOnly, since JavaScript has to
 * write it. It carries no secret - it is a boolean "has used the product" - so
 * that costs nothing. A crawler, which runs no JavaScript, never gets it and so
 * always sees the landing page, which is what we want anyway.
 */
export function MarkVisited() {
  useEffect(() => {
    if (document.cookie.includes(`${VISIT_COOKIE}=1`)) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${VISIT_COOKIE}=1; Max-Age=${VISIT_COOKIE_MAX_AGE}; Path=/; SameSite=Lax` +
      secure;
  }, []);

  return null;
}
