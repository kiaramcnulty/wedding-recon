"use client";

import Link from "next/link";

import { captureClient } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

/**
 * A "verify your business" acquisition link into the portal, tracked so we can
 * see which surface (vendor page vs landing footer) sends vendors in. The
 * capture fires on click and the navigation is a soft in-app nav, so PostHog
 * flushes normally (no page unload). One component, both surfaces.
 */
export function VerifyBusinessLink({
  source,
  className,
  children,
}: {
  source: "vendor_page" | "landing_footer";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href="/portal"
      onClick={() => captureClient("vendor_verify_link_clicked", { source })}
      className={cn(className)}
    >
      {children}
    </Link>
  );
}
