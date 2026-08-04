import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { buttonVariants } from "@/components/ui/button";
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
          <Link
            href="#how-it-works"
            className="hidden px-1 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            How it works
          </Link>
          <Link
            href="#faq"
            className="hidden px-1 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            FAQ
          </Link>
          <Link
            href={APP_HREF}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-9 bg-brand px-4 text-white hover:bg-brand/90",
            )}
          >
            Open the app
          </Link>
        </nav>
      </div>
    </header>
  );
}
