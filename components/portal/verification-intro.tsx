import { BadgeCheck, TrendingUp, ArrowUpRight, PencilRuler } from "lucide-react";

import { PRICE_PER_MONTH, PRICE_BILLING_NOTE } from "@/lib/portal/verification";

/**
 * The one-screen pitch at the top of the portal: what Vendor Verification is and
 * what a vendor gets for it. Benefits are kept to what the product actually
 * delivers (checkmark, a modest Explore ranking boost, a CTA link, and
 * vendor-provided listing details) — nothing here promises a perk the app does
 * not ship. Server component, no client JS.
 */
const BENEFITS = [
  {
    icon: BadgeCheck,
    title: "A verified checkmark",
    body: "A trust signal on your profile and in couples' search results.",
  },
  {
    icon: TrendingUp,
    title: "Higher visibility",
    body: "Verified vendors sort ahead of unverified ones in the same Explore results.",
  },
  {
    icon: ArrowUpRight,
    title: "Guide couples onward",
    body: "A call-to-action button that links straight to your inquiry or booking page.",
  },
  {
    icon: PencilRuler,
    title: "Your own verified details",
    body: "Add pricing, photos, website, and the services couples filter by.",
  },
] as const;

export function VerificationIntro() {
  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-muted/30 p-5">
      <div>
        <h1 className="font-heading text-xl font-semibold">Verify your business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claim your business on Wedding Recon, keep its details accurate, and
          stand out to couples planning their wedding.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex items-start gap-2.5">
            <b.icon className="mt-0.5 size-4 shrink-0 text-brand-ink" />
            <div>
              <p className="text-sm font-medium leading-snug">{b.title}</p>
              <p className="text-sm leading-snug text-muted-foreground">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-sm">
        <span className="font-semibold">{PRICE_PER_MONTH}</span>
        <span className="text-muted-foreground"> — {PRICE_BILLING_NOTE}. Cancel anytime.</span>
      </p>
    </div>
  );
}
