"use client";

import Link from "next/link";

import { captureClient } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

/**
 * A tracked CTA on /vendors. The acquisition funnel is now two hops - a link
 * click somewhere in the app (`vendor_verify_link_clicked`) lands on this page,
 * and this event is the step after it - so keeping them separate is what makes
 * the page measurable rather than invisible between the link and the sign-in.
 *
 * `href` defaults to /portal, which routes by account state: a signed-out
 * visitor is sent back here, a signed-in one goes straight to their dashboard.
 * The sign-in CTA passes its own href instead.
 */
export function PortalCtaLink({
  placement,
  href = "/portal",
  className,
  children,
}: {
  placement: "hero" | "closing" | "signin";
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => captureClient("vendor_portal_cta_clicked", { placement })}
      className={cn(className)}
    >
      {children}
    </Link>
  );
}
