import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { LANDING_HREF } from "@/lib/landing/nav";
import { ProfileMenu } from "@/components/profile-menu";

/**
 * Vendor portal shell. Responsive (vendors are mobile-first, but many will be
 * at a desk), single readable column — deliberately NOT the 480px app frame and
 * NO bottom nav. Same width as the Hub (`max-w-[760px]`).
 *
 * The portal never shows recon or links to a vendor's public page; it is only
 * for a vendor managing their own listing.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <Link
          href={LANDING_HREF}
          className="flex items-center gap-2 no-underline"
        >
          <BadgeCheck className="size-5 text-brand-ink" />
          <span className="font-heading text-sm font-semibold">
            Wedding Recon for vendors
          </span>
        </Link>
        <ProfileMenu className="shrink-0" />
      </header>
      <main className="flex flex-1 flex-col pb-12">{children}</main>
    </div>
  );
}
