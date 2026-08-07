"use client";

import { CATEGORY_PLURAL, type VendorType } from "@/lib/constants/categories";
import { VendorListSheet } from "@/components/map/vendor-list-sheet";
import type { VendorListEntry } from "@/components/map/vendor-feed";

interface ClusterListSheetProps {
  /**
   * The cluster's vendors, already ordered and ranked by the map — the same
   * comparator the results feed uses (`compareRanked` in `vendor-map.tsx`).
   *
   * This used to be a bare id list in MapLibre leaf order, which is supercluster
   * tree order: arbitrary to a reader, and different from the order the same
   * vendors got in the results feed (reported 2026-08-07).
   */
  entries: VendorListEntry[];
  vendorType: VendorType;
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
  onClose,
}: ClusterListSheetProps) {
  return (
    <VendorListSheet
      entries={entries}
      heading={`${entries.length} ${CATEGORY_PLURAL[vendorType]} available`}
      scrollKey="wr:clusterScroll"
      onClose={onClose}
    />
  );
}
