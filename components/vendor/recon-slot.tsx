"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Pencil, PlusCircle } from "lucide-react";

import { MINE_TONE } from "@/components/vendor/recon-card";
import { refreshViewer, useViewer } from "@/lib/viewer";
import { useVendorSelfHref } from "@/lib/vendors/use-self-href";
import type { VendorRef } from "@/lib/vendors/slug";

/** One slot, two looks: both MUST keep these box metrics, or the list moves. */
const SLOT_CLASS =
  "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90";

export interface ReconSlotVendor extends VendorRef {
  name: string;
  vendor_type: string;
}

/**
 * The public "Add recon" button. Rendered as-is by the server page as the
 * Suspense fallback (the cached HTML), and by `ReconSlot` for anyone without
 * recon here. Filled with the vendor's category color (the app's only accent)
 * so it pops against the otherwise grayscale UI.
 */
export function AddReconLink({
  vendor,
  colorHex,
  selfHref,
}: {
  vendor: ReconSlotVendor;
  colorHex: string;
  /** This page's URL (with its `from`), so the form returns here. */
  selfHref: string;
}) {
  return (
    <Link
      href={`/add?vendorId=${vendor.id}&vendorName=${encodeURIComponent(vendor.name)}&vendorType=${vendor.vendor_type}&from=${encodeURIComponent(selfHref)}`}
      style={{ backgroundColor: colorHex }}
      className={`${SLOT_CLASS} text-white`}
    >
      <PlusCircle className="size-4" />
      Add recon
    </Link>
  );
}

/**
 * The slot at the top of a vendor page's recon list: "Add recon", or "Edit my
 * recon" for someone who already has recon on this vendor.
 *
 * Kiara, 2026-11-14: the vendor page is cached, so it can no longer put the
 * viewer's own entry first without moving it after paint. Instead the list
 * stays in public order for everyone, the viewer's card is marked where it
 * falls (ReconCard), and this slot, which every visitor already gets, turns
 * into the way back to their entry. Same box either way, so nothing below it
 * moves. (It used to disappear for people with recon.)
 *
 * The entry comes from the page's own list when it is there, which needs no
 * query and is right on first render. Only a FLAGGED entry (hidden from the
 * public list pending review, but still theirs) needs the viewer store's read.
 */
export function ReconSlot({
  vendor,
  colorHex,
  entries,
}: {
  vendor: ReconSlotVendor;
  colorHex: string;
  /** The page's public entries, as `{ id, author_id }`. */
  entries: { id: string; author_id: string }[];
}) {
  const viewer = useViewer();
  const selfHref = useVendorSelfHref(vendor);

  // Catches a sign-out (a server action the browser client never hears about)
  // before this page draws the old account's state; a no-op otherwise.
  useEffect(() => {
    void refreshViewer();
  }, []);

  const ownEntryId = viewer
    ? (entries.find((e) => e.author_id === viewer.userId)?.id ??
      viewer.ownRecon?.get(vendor.id) ??
      null)
    : null;

  if (!ownEntryId) {
    return <AddReconLink vendor={vendor} colorHex={colorHex} selfHref={selfHref} />;
  }

  return (
    <Link
      href={`/recon/${ownEntryId}/edit?from=${encodeURIComponent(selfHref)}`}
      style={MINE_TONE}
      className={SLOT_CLASS}
    >
      <Pencil className="size-4" />
      Edit my recon
    </Link>
  );
}
