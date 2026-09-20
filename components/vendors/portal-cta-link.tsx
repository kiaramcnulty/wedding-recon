"use client";

import Link from "next/link";

import { captureClient } from "@/lib/analytics/posthog";
import { SIGN_IN_HREF } from "@/lib/vendors/content";
import { cn } from "@/lib/utils";

/**
 * A tracked CTA on /vendors. The acquisition funnel is now two hops - a link
 * click somewhere in the app (`vendor_verify_link_clicked`) lands on this page,
 * and this event is the step after it - so keeping them separate is what makes
 * the page measurable rather than invisible between the link and the sign-in.
 *
 * `href` defaults to the SIGN-IN form, not to /portal. /portal is the router
 * that sends a signed-out visitor to /vendors, so a CTA on /vendors pointing at
 * it just reloaded this page - which is what the button did until 2026-09-20.
 * The reader has already seen the pitch; the next step is the one OTP form that
 * signs in or creates the account. `back=/vendors` returns them here if they
 * change their mind, and `from=/portal` is where sign-in lands.
 *
 * Cold links from ELSEWHERE in the app still point at /portal - see
 * components/portal/verify-business-link.tsx.
 */
export function PortalCtaLink({
  placement,
  href = SIGN_IN_HREF,
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
