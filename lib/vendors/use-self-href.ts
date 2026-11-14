"use client";

import { useSearchParams } from "next/navigation";

import { safeReturnPath, vendorPath, type VendorRef } from "@/lib/vendors/slug";

/**
 * This vendor page's own URL INCLUDING its `from` return path. Handed to the
 * Add and Edit recon forms so they return to a vendor page that still knows
 * where it came from; dropping the `from` is what used to strand people
 * bouncing between a form and the page.
 *
 * Read in the browser because the page is cached (ISR) and its server render
 * never sees the query string. `useSearchParams` makes a statically rendered
 * page client-render up to the nearest Suspense boundary, so every caller sits
 * inside one whose fallback is the same control pointing at the bare
 * `vendorPath()`: identical to look at, and only the link target differs.
 */
export function useVendorSelfHref(vendor: VendorRef): string {
  return vendorPath(vendor, safeReturnPath(useSearchParams().get("from")));
}
