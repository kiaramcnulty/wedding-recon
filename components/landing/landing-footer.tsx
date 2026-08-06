import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { CONTACT_EMAIL, FOOTER } from "@/lib/landing/content";
import { APP_HREF } from "@/lib/landing/nav";

const PRODUCT_LINKS = [
  { href: APP_HREF, label: FOOTER.exploreLabel },
  { href: "/add", label: FOOTER.addReconLabel },
  { href: "/hub", label: FOOTER.hubLabel },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs space-y-3">
          <BrandLockup size="md" showDomain />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {FOOTER.blurb}
          </p>
        </div>

        <div className="flex gap-12 sm:gap-16">
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {FOOTER.productHeading}
            </p>
            <ul className="space-y-2 text-sm">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {FOOTER.aboutHeading}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {FOOTER.termsLabel}
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {FOOTER.contactLabel}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t px-5 py-5">
        <p className="mx-auto w-full max-w-5xl text-xs text-muted-foreground">
          © {new Date().getFullYear()} Wedding Recon. {FOOTER.disclaimer}
        </p>
      </div>
    </footer>
  );
}
