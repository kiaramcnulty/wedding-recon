"use client";

import Link from "next/link";

import { clearVendorCookie } from "@/components/mark-vendor";
import { APP_HREF } from "@/lib/landing/nav";

/**
 * The way out for a couple who reached the portal by mistake (the profile
 * menu's vendor link, or "Are you the owner?" on a vendor page). Clears the
 * business-side cookie so `/` stops sending them here, then goes to Explore.
 * Shown on the portal's step 1 only - once a business is claimed, the account
 * is a vendor's.
 */
export function NotAVendorLink() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      Not a vendor?{" "}
      <Link
        href={APP_HREF}
        onClick={clearVendorCookie}
        className="font-medium text-foreground underline underline-offset-2"
      >
        Back to Explore
      </Link>
    </p>
  );
}
