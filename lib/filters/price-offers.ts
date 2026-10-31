/**
 * Per-service price offers: `vendors.filters.price_offers`.
 *
 * A vendor priced by service scope (a planner day-of vs full planning, later a
 * florist full service vs a la carte) cannot be described by one flattened
 * `price_min`/`price_max`. Each offer is one scope with its own price and the
 * verbatim evidence for it. The legacy fields stay for display and backward
 * compatibility; matching prefers an offer for the scope the couple asked for.
 * See docs/customer-journey-implementation-plan.md (Milestone 2).
 *
 * Plain JSONB inside `filters`, so no migration. Missing fields are ABSENT,
 * never 0 or false: an offer without a price is not a free service.
 */

export const OFFER_SCOPES = {
  planner: ["day_of", "month_of", "partial_planning", "full_planning", "a_la_carte"],
} as const;

export type OfferBasis = "package" | "per_hour" | "percent_of_budget";
export type OfferKind = "starting_at" | "range" | "single_figure";

export interface PriceOffer {
  scope: string;
  price_min?: number;
  price_max?: number;
  price_kind: OfferKind;
  basis: OfferBasis;
  /** percent_of_budget only: e.g. 10 for 10%. */
  percent?: number;
  /** Verbatim evidence for the price. */
  quote: string;
  /**
   * Verbatim package name, when the page prints it far from the price (a
   * services page with a long feature list between the two).
   */
  label_quote?: string;
  /** Where the quote came from (research file path or URL). */
  source: string;
  /** When the evidence was captured, ISO date. */
  as_of?: string;
  confidence: "high" | "medium";
}

const BASES: readonly string[] = ["package", "per_hour", "percent_of_budget"];
const KINDS: readonly string[] = ["starting_at", "range", "single_figure"];

function money(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/**
 * Validate one raw offer for a vendor type. Returns the cleaned offer, or a
 * reason it was rejected. Rejecting is the safe direction: a dropped offer
 * leaves the vendor on its legacy fields (partial), never on a wrong price.
 */
export function parseOffer(
  vendorType: keyof typeof OFFER_SCOPES,
  raw: unknown,
): { offer: PriceOffer } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "not an object" };
  const r = raw as Record<string, unknown>;
  const scopes: readonly string[] = OFFER_SCOPES[vendorType];
  if (typeof r.scope !== "string" || !scopes.includes(r.scope)) return { error: `unknown scope ${String(r.scope)}` };
  if (typeof r.basis !== "string" || !BASES.includes(r.basis)) return { error: `unknown basis ${String(r.basis)}` };
  if (typeof r.price_kind !== "string" || !KINDS.includes(r.price_kind)) return { error: `unknown price_kind ${String(r.price_kind)}` };
  if (typeof r.quote !== "string" || r.quote.trim().length < 4) return { error: "missing quote" };
  if (typeof r.source !== "string" || !r.source.trim()) return { error: "missing source" };
  if (r.confidence !== "high" && r.confidence !== "medium") return { error: "confidence must be high or medium" };

  const min = money(r.price_min);
  const max = money(r.price_max);
  const percent = money(r.percent);
  if (r.price_min != null && min === undefined) return { error: "price_min not a nonnegative number" };
  if (r.price_max != null && max === undefined) return { error: "price_max not a nonnegative number" };
  if (min !== undefined && max !== undefined && max < min) return { error: "price_max below price_min" };
  if (r.basis === "percent_of_budget") {
    if (percent === undefined || percent > 100) return { error: "percent_of_budget needs a percent 0-100" };
  } else if (min === undefined && max === undefined) {
    return { error: "no price" };
  }
  if (r.price_kind === "range" && (min === undefined || max === undefined)) return { error: "range needs min and max" };
  if (r.price_kind === "starting_at" && max !== undefined) return { error: "starting_at has no max" };

  return {
    offer: {
      scope: r.scope,
      ...(min !== undefined && { price_min: min }),
      ...(max !== undefined && { price_max: max }),
      price_kind: r.price_kind as OfferKind,
      basis: r.basis as OfferBasis,
      ...(r.basis === "percent_of_budget" && { percent }),
      quote: r.quote.trim(),
      ...(typeof r.label_quote === "string" && r.label_quote.trim() && { label_quote: r.label_quote.trim() }),
      source: r.source.trim(),
      ...(typeof r.as_of === "string" && { as_of: r.as_of }),
      confidence: r.confidence,
    },
  };
}

/** The offers for one scope; at most one per scope is stored. */
export function offerFor(filters: Record<string, unknown> | null | undefined, scope: string): PriceOffer | undefined {
  const list = filters?.["price_offers"];
  if (!Array.isArray(list)) return undefined;
  return (list as PriceOffer[]).find((o) => o && o.scope === scope);
}
