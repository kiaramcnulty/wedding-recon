import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { CONTACT_EMAIL } from "@/lib/landing/content";
import { APP_HREF } from "@/lib/landing/nav";

const PRODUCT_LINKS = [
  { href: APP_HREF, label: "Explore the map" },
  { href: "/add", label: "Add recon" },
  { href: "/hub", label: "Planning Hub" },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs space-y-3">
          <BrandLockup size="md" showDomain />
          <p className="text-sm leading-relaxed text-muted-foreground">
            A community directory of Colorado wedding vendors, built on the
            price quotes and notes couples share with each other.
          </p>
        </div>

        <div className="flex gap-12 sm:gap-16">
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Product
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
              About
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Terms &amp; disclaimer
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t px-5 py-5">
        <p className="mx-auto w-full max-w-5xl text-xs text-muted-foreground">
          © {new Date().getFullYear()} Wedding Recon. Recon entries are personal
          experiences shared by couples, not verified facts — always confirm
          pricing and details with the vendor.
        </p>
      </div>
    </footer>
  );
}
