import { PRICE_PER_MONTH, PRICE_BILLING_NOTE } from "@/lib/portal/verification";
import { VERIFICATION_BENEFITS } from "@/lib/vendors/content";

/**
 * The one-screen pitch at the top of the portal: what Vendor Verification is and
 * what a vendor gets for it. Server component, no client JS.
 *
 * The benefit list is NOT declared here - it is `VERIFICATION_BENEFITS` in
 * `lib/vendors/content.ts`, shared with the public `/vendors` page. A vendor
 * reads that page before signing up and this one after, so a second copy of the
 * list would eventually promise them two different things.
 */
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
        {VERIFICATION_BENEFITS.map((b) => (
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
