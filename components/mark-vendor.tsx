"use client";

import { useEffect } from "react";

import { VENDOR_COOKIE, VENDOR_COOKIE_MAX_AGE } from "@/lib/landing/nav";

/**
 * Marks this browser as business-side (VENDOR_COOKIE), so a later visit to `/`
 * goes to the portal instead of Explore. Rendered by the portal dashboard,
 * which only renders for a signed-in account.
 *
 * Client-side for the same reason as <MarkVisited>: a prefetch fetches the
 * payload but never renders, so it cannot set this. The profile menu links to
 * /portal from every app screen, so a proxy-written cookie would tag couples
 * who never opened the portal.
 *
 * Unlike MarkVisited it writes on EVERY render, which renews the 30 days - a
 * vendor managing their listing should not lapse back to Explore.
 *
 * `enabled={false}` clears it instead: the dashboard passes that for site
 * admins, whose own `/` should stay on the couples product.
 */
export function MarkVendor({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (enabled) writeVendorCookie();
    else clearVendorCookie();
  }, [enabled]);

  return null;
}

function writeVendorCookie() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${VENDOR_COOKIE}=1; Max-Age=${VENDOR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax` +
    secure;
}

export function clearVendorCookie() {
  document.cookie = `${VENDOR_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
