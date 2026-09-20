export interface EvidenceRow {
  base_filters: Record<string, unknown> | null;
  filter_overrides: Record<string, unknown> | null;
  filters_dirty_at: string | null;
}

/** Dirty extracted/recon evidence is hidden; current published overrides survive. */
export function effectivePublicFilters(row: EvidenceRow): Record<string, unknown> | null {
  const overrides = row.filter_overrides ?? {};
  if (row.filters_dirty_at) return Object.keys(overrides).length ? overrides : null;
  const merged = { ...(row.base_filters ?? {}), ...overrides };
  return Object.keys(merged).length ? merged : null;
}

export interface ConnectorRanked {
  id: string;
  rank: -1 | 0 | 1;
  verified: boolean;
  matched: number;
  qScore: number;
  priced: boolean;
  photo: boolean;
  distance: number;
}

/** Full/partial partition first; paid verification can never cross it. */
export function compareConnectorRanked(a: ConnectorRanked, b: ConnectorRanked): number {
  return (
    b.rank - a.rank ||
    Number(b.verified) - Number(a.verified) ||
    b.matched - a.matched ||
    b.qScore - a.qScore ||
    Number(b.priced) - Number(a.priced) ||
    Number(b.photo) - Number(a.photo) ||
    a.distance - b.distance ||
    a.id.localeCompare(b.id)
  );
}

export function budgetAssessment(
  min: number | null,
  max: number | null,
  kind: unknown,
  budgetMax?: number,
): string | null {
  if (budgetMax == null) return null;
  if (min != null && min <= budgetMax && max != null && max > budgetMax) {
    return "Possible overlap, but some of the reported range exceeds the budget ceiling.";
  }
  if (kind === "starting_at" && min != null && min <= budgetMax) {
    return "The starting floor is within the ceiling, but the final total is unknown.";
  }
  return "Recorded pricing is within or overlaps the requested ceiling.";
}

export async function acquireBoundedPages<T>(
  fetchPage: (after: T | null, pageSize: number) => Promise<T[]>,
  pageSize: number,
  maximum: number,
): Promise<{ rows: T[]; exceeded: boolean }> {
  const rows: T[] = [];
  let after: T | null = null;
  while (rows.length <= maximum) {
    const page = await fetchPage(after, pageSize);
    rows.push(...page);
    if (page.length < pageSize) return { rows, exceeded: false };
    after = page[page.length - 1] ?? null;
  }
  return { rows, exceeded: true };
}
