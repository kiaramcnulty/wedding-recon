"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Whether this tab has a page of OURS to step back to.
 *
 * `window.history.length` cannot answer that: a fresh tab opened from a shared
 * link or a Google result already counts its blank entry (and the referrer),
 * so `router.back()` there leaves the site or does nothing at all — the vendor
 * page back button was dead on every cold arrival. Instead count the distinct
 * pages this document has shown. Module state, so it survives client-side
 * navigation and resets on a full load, which is exactly the boundary we want:
 * after a reload we fall back to a fixed destination, never to a dead button.
 */
let pagesShown = 0;
let lastPathname: string | null = null;

export function hasInAppHistory() {
  return pagesShown > 1;
}

/** Rendered once in the root layout so every route, landing page included, counts. */
export function InAppHistoryTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Compare against the last pathname rather than counting effect runs:
    // Strict Mode runs a mount effect twice in dev, which would otherwise make
    // a cold arrival look like it had history.
    if (pathname === lastPathname) return;
    lastPathname = pathname;
    pagesShown += 1;
  }, [pathname]);
  return null;
}
