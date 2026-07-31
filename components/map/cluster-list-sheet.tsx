"use client";

import * as React from "react";
import { CATEGORY_PLURAL, type VendorType } from "@/lib/constants/categories";
import { VendorListSheet } from "@/components/map/vendor-list-sheet";

interface ClusterListSheetProps {
  /** Vendor ids in the tapped cluster (leaf order from the map). */
  ids: string[];
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
  ids,
  vendorType,
  onClose,
}: ClusterListSheetProps) {
  const entries = React.useMemo(
    () => ids.map((id) => ({ id, vendorType })),
    [ids, vendorType],
  );

  return (
    <VendorListSheet
      entries={entries}
      heading={`${ids.length} ${CATEGORY_PLURAL[vendorType]} available`}
      scrollKey="wr:clusterScroll"
      onClose={onClose}
    />
  );
}
