"use client";

import * as React from "react";
import { CATEGORY_PLURAL, type VendorType } from "@/lib/constants/categories";
import { VendorListSheet } from "@/components/map/vendor-list-sheet";
import { type ClusterEntry } from "@/components/map/vendor-map";
import type { FilterSelections } from "@/lib/filters/match";

interface ClusterListSheetProps {
  /** Vendors in the tapped cluster, full matches first (see ClusterOpenPayload). */
  entries: ClusterEntry[];
  vendorType: VendorType;
  /** Active attribute filters per type, forwarded to the feed's cards. */
  selections?: FilterSelections;
  onClose: () => void;
}

/**
 * Feed of every vendor in a tapped map cluster. A cluster is per-type by
 * construction (one clustered source per vendor type), so every row here shares
 * one type — that's the only thing separating this from the "all results on
 * screen" feed, which mixes them. The sheet itself lives in
 * `vendor-list-sheet.tsx`.
 */
export function ClusterListSheet({
  entries,
  vendorType,
  selections,
  onClose,
}: ClusterListSheetProps) {
  // Passing `rank` through is what lets this feed draw the partial-tier divider
  // it already knows how to render — before, the cluster feed handed over bare
  // ids, so every row read as a full match however little it matched.
  const rows = React.useMemo(
    () => entries.map((e) => ({ ...e, vendorType })),
    [entries, vendorType],
  );

  // The heading counts MATCHES, not leaves, for the same reason the bubble it
  // came from does: with a filter active most of a cluster is usually the
  // partial tier, and "35 venues available" over 1 match is the claim that
  // started this. The divider below labels the remainder.
  const matched = React.useMemo(
    () => entries.reduce((n, e) => n + e.rank, 0),
    [entries],
  );
  const heading =
    matched === entries.length
      ? `${entries.length} ${CATEGORY_PLURAL[vendorType]} available`
      : `${matched} of ${entries.length} ${CATEGORY_PLURAL[vendorType]} match`;

  return (
    <VendorListSheet
      entries={rows}
      heading={heading}
      scrollKey="wr:clusterScroll"
      selections={selections}
      onClose={onClose}
    />
  );
}
