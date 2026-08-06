import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { buttonVariants } from "@/components/ui/button";
import { HEADER } from "@/lib/landing/content";
import { APP_HREF, LANDING_HREF } from "@/lib/landing/nav";
import { cn } from "@/lib/utils";

/**
 * Landing-page header. The wordmark points at LANDING_HREF rather than `/`:
 * a visitor who arrived here from inside the app has the visit cookie set, so a
 * bare `/` would be bounced straight back to Explore by the first-visit gate.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-3">
        <Link
          href={LANDING_HREF}
          aria-label="Wedding Recon home"
          className="no-underline"
        >
          <BrandLockup size="md" />
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-4">
          {/* Plain anchors, not next/link. A <Link> on a same-page fragment is
              a router navigation to `/`, and `/` is exactly the path the
              first-visit gate redirects to /explore once someone has the visit
              cookie - so the "scroll down" links could open the app instead
              (reported 2026-08-04). A bare <a href="#id"> is handled by the
              browser: it scrolls, never routes, and never prefetches. */}
          <a
            href="#how-it-works"
            className="hidden px-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground sm:inline"
          >
            {HEADER.howItWorks}
          </a>
          <a
            href="#faq"
            className="hidden px-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground sm:inline"
          >
            {HEADER.faq}
          </a>
          <Link
            href={APP_HREF}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-9 bg-brand px-4 text-white hover:bg-brand/90",
            )}
          >
            {HEADER.cta}
          </Link>
        </nav>
      </div>
    </header>
  );
}
