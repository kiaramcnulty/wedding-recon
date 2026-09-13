/**
 * Vendor Verification pricing copy, in ONE place so the button, the step, and the
 * intro can never disagree. The plan locks the billing model: a single recurring
 * price billed $120 every 6 months (effective $20/month) — no monthly price. So
 * "$20/month" is a framing of the same charge, and the billing note is what keeps
 * it honest. Stripe Checkout shows the real 6-month terms regardless.
 */
export const PRICE_PER_MONTH = "$20/month";
export const PRICE_BILLING_NOTE = "billed $120 every 6 months";
export const PRICE_LINE = `${PRICE_PER_MONTH} — ${PRICE_BILLING_NOTE}`;
