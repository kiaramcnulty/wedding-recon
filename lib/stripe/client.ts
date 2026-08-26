import "server-only";
import Stripe from "stripe";

/**
 * Server-only Stripe client. Reads STRIPE_SECRET_KEY at call time (never at
 * module load) so an unset key throws a clear error only where Stripe is
 * actually used, not on every import. apiVersion is left at the SDK default so
 * we do not have to chase pinned-version type literals.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}
