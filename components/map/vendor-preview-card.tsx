"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

/**
 * The vendor preview card + its data fetch, shared by BOTH map surfaces: the
 * cluster list feed (`cluster-list-sheet.tsx`) and the single-pin bottom
 * preview (`vendor-pin-preview.tsx`). One card shape, one query — change the
 * card here and both move together.
 */

/** Abbreviated text-only preview of one recon entry (photos intentionally omitted). */
export interface ReconSlide {
  priceText: string | null;
  priceDetails: string | null;
  notes: string | null;
}

export interface VendorPreview {
  id: string;
  name: string;
  reconCount: number;
  /**
   * Ordered image candidates: Google photo first, then a recon thumbnail. Tried
   * in order (each on error), falling through to a category placeholder.
   */
  photoCandidates: string[];
  /** Text previews of the vendor's recon entries (newest first, text-less entries skipped). */
  slides: ReconSlide[];
}

/** Minimal row shapes for the on-tap detail fetch (client queries are untyped). */
interface VendorLite {
  id: string;
  name: string;
  google_photos: unknown[] | null;
  google_place_id: string | null;
}
interface ReconRow {
  vendor_id: string;
  price_text: string | null;
  price_details: string | null;
  notes: string | null;
  media: { thumb_path: string | null; storage_path: string }[] | null;
}

/**
 * Fetch preview data for a set of vendor ids. Returns null while in flight, then
 * the built previews in the *given id order* (ids whose vendor row is gone are
 * dropped). Two client queries, no RPC/migration: the vendor rows, and their
 * active recon entries with media (tallied for the count + a fallback thumbnail).
 */
export function useVendorPreviews(ids: string[]): VendorPreview[] | null {
  const [items, setItems] = React.useState<VendorPreview[] | null>(null);

  // Stable key so the fetch effect doesn't re-run on array identity changes.
  const idsKey = ids.join(",");

  React.useEffect(() => {
    let cancelled = false;
    const idList = idsKey ? idsKey.split(",") : [];
    (async () => {
      setItems(null);
      const supabase = createClient();
      const [vendorsRes, reconRes] = await Promise.all([
        supabase
          .from("vendors")
          .select("id, name, google_photos, google_place_id")
          .in("id", idList),
        supabase
          .from("recon_entries")
          .select(
            "vendor_id, price_text, price_details, notes, media:recon_media(thumb_path, storage_path)",
          )
          .eq("status", "active")
          .in("vendor_id", idList)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const vendors = (vendorsRes.data ?? []) as unknown as VendorLite[];
      const recons = (reconRes.data ?? []) as unknown as ReconRow[];

      const vendorById = new Map<string, VendorLite>();
      for (const v of vendors) vendorById.set(v.id, v);

      // Tally active recon counts, capture the first recon thumbnail per vendor,
      // and collect text previews (newest first — the query orders by created_at
      // desc, matching the vendor page). Entries with no text get no slide.
      const counts = new Map<string, number>();
      const reconThumb = new Map<string, string>();
      const slidesByVendor = new Map<string, ReconSlide[]>();
      for (const row of recons) {
        counts.set(row.vendor_id, (counts.get(row.vendor_id) ?? 0) + 1);
        if (!reconThumb.has(row.vendor_id)) {
          const first = row.media?.[0];
          if (first) {
            const path = first.thumb_path ?? first.storage_path;
            reconThumb.set(
              row.vendor_id,
              supabase.storage.from("recon-media").getPublicUrl(path).data
                .publicUrl,
            );
          }
        }
        const priceText = row.price_text?.trim() || null;
        const priceDetails = row.price_details?.trim() || null;
        const notes = row.notes?.trim() || null;
        if (priceText || priceDetails || notes) {
          const list = slidesByVendor.get(row.vendor_id) ?? [];
          list.push({ priceText, priceDetails, notes });
          slidesByVendor.set(row.vendor_id, list);
        }
      }

      // Preserve the caller's id order; drop ids whose vendor row is gone.
      const built: VendorPreview[] = idList.flatMap((id) => {
        const v = vendorById.get(id);
        if (!v) return [];
        const candidates: string[] = [];
        const hasGoogle =
          (v.google_photos?.length ?? 0) > 0 || !!v.google_place_id;
        if (hasGoogle) candidates.push(`/api/vendor-photo/${id}?i=0`);
        const rt = reconThumb.get(id);
        if (rt) candidates.push(rt);
        return [
          {
            id,
            name: v.name,
            reconCount: counts.get(id) ?? 0,
            photoCandidates: candidates,
            slides: slidesByVendor.get(id) ?? [],
          },
        ];
      });

      if (!cancelled) setItems(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return items;
}

/**
 * One vendor preview: photo + category pill + name + recon count, with a
 * swipeable strip of recon-entry previews beneath it when there are any.
 * Tapping anywhere calls `onOpen` (the vendor page).
 */
export function VendorPreviewCard({
  item,
  vendorType,
  onOpen,
  className,
}: {
  item: VendorPreview;
  vendorType: VendorType;
  onOpen: () => void;
  className?: string;
}) {
  const category = CATEGORIES[vendorType];
  const CategoryIcon = category.icon;

  return (
    // The scrollable carousel can't live inside a <button>, so the card is a
    // div: button row on top, swipeable previews below.
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/40",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-2 text-left"
      >
        <VendorPreviewPhoto
          candidates={item.photoCandidates}
          vendorType={vendorType}
          alt={item.name}
          className="size-24 shrink-0 rounded-lg"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-1">
          <span
            className="inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: category.lightHex,
              color: category.textHex,
            }}
          >
            <CategoryIcon className="size-3 shrink-0" />
            {category.label}
          </span>
          <span className="block truncate font-heading text-sm font-semibold">
            {item.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {reconLabel(item.reconCount)}
          </span>
        </div>
      </button>
      {item.slides.length > 0 && (
        <ReconPreviewCarousel slides={item.slides} onOpen={onOpen} />
      )}
    </div>
  );
}

/**
 * Horizontal, swipeable strip of abbreviated recon-entry previews — text only,
 * photos deliberately omitted at this altitude. Native scroll-snap does the
 * swiping (the host sheet's swipe-down handler yields via its axis lock); a tap
 * anywhere opens the vendor page — browsers don't fire click after a scroll
 * gesture, so swipes never navigate. Slides peek the next entry as the
 * swipe affordance.
 */
function ReconPreviewCarousel({
  slides,
  onOpen,
}: {
  slides: ReconSlide[];
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer snap-x snap-mandatory gap-2 overflow-x-auto scroll-pl-2 px-2 pb-2"
      style={{ scrollbarWidth: "none" }}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          className={cn(
            "flex shrink-0 snap-start flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2",
            slides.length === 1 ? "w-full" : "w-[85%]",
          )}
        >
          {slide.priceText && (
            <p className="truncate text-sm font-semibold">{slide.priceText}</p>
          )}
          {slide.priceDetails && (
            <p className="truncate text-xs text-muted-foreground">
              {slide.priceDetails}
            </p>
          )}
          {slide.notes && (
            <p className="line-clamp-2 text-xs leading-relaxed">{slide.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function reconLabel(n: number): string {
  if (n === 0) return "No recon yet";
  if (n === 1) return "1 recon entry";
  return `${n} recon entries`;
}

/**
 * Card photo with an ordered fallback chain (Google → recon → placeholder).
 * `loading="lazy"` keeps off-screen images off the network until scrolled near.
 */
function VendorPreviewPhoto({
  candidates,
  vendorType,
  alt,
  className,
}: {
  candidates: string[];
  vendorType: VendorType;
  alt: string;
  className?: string;
}) {
  const [idx, setIdx] = React.useState(0);
  const category = CATEGORIES[vendorType];
  const src = candidates[idx];

  if (!src) {
    const Icon = category.icon;
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ backgroundColor: category.lightHex, color: category.textHex }}
        aria-hidden
      >
        <Icon className="size-7 opacity-70" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => i + 1)}
      className={cn("bg-muted object-cover", className)}
    />
  );
}
