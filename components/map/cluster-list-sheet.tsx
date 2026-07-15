"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  CATEGORY_PLURAL,
  type VendorType,
} from "@/lib/constants/categories";

interface ClusterListSheetProps {
  /** Vendor ids in the tapped cluster (leaf order from the map). */
  ids: string[];
  vendorType: VendorType;
  onClose: () => void;
}

interface ClusterItem {
  id: string;
  name: string;
  reconCount: number;
  /**
   * Ordered image candidates: Google photo first, then a recon thumbnail. Tried
   * in order (each on error), falling through to a category placeholder.
   */
  photoCandidates: string[];
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
  media: { thumb_path: string | null; storage_path: string }[] | null;
}

/**
 * Zillow-style feed of every vendor in a tapped map cluster. Opens as a
 * bottom sheet over the map; dismissed by the ✕, a swipe-down, Escape, or a
 * tap on the dimmed backdrop. Tapping an item opens that vendor's page (with a
 * `from` that returns here). No filtering/saving yet — just browse + drill in.
 *
 * Rendered on demand (only while a cluster is open), so — like the external-link
 * overlay — it needs no mounted-state guard: the DOM exists by the time it does.
 */
export function ClusterListSheet({
  ids,
  vendorType,
  onClose,
}: ClusterListSheetProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<ClusterItem[] | null>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Stable key so the fetch effect doesn't re-run on array identity changes.
  const idsKey = ids.join(",");

  // Lock background scroll + close on Escape while the sheet is up.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Fetch names, active recon counts, and photo hints for the cluster's vendors.
  // Two client queries (no RPC/migration): the vendor rows, and their active
  // recon entries with media (tallied for the count + a fallback thumbnail).
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
          .select("vendor_id, media:recon_media(thumb_path, storage_path)")
          .eq("status", "active")
          .in("vendor_id", idList),
      ]);
      if (cancelled) return;

      const vendors = (vendorsRes.data ?? []) as unknown as VendorLite[];
      const recons = (reconRes.data ?? []) as unknown as ReconRow[];

      const vendorById = new Map<string, VendorLite>();
      for (const v of vendors) vendorById.set(v.id, v);

      // Tally active recon counts + capture the first recon thumbnail per vendor.
      const counts = new Map<string, number>();
      const reconThumb = new Map<string, string>();
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
      }

      // Preserve the cluster's leaf order; drop ids whose vendor row is gone.
      const built: ClusterItem[] = idList.flatMap((id) => {
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
          },
        ];
      });

      setItems(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  // Swipe-down-to-dismiss. Native (non-passive) listeners so touchmove can
  // preventDefault — React attaches touch listeners as passive. Only engages
  // when the feed is scrolled to the top, so it never fights list scrolling.
  React.useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    let startY: number | null = null;
    let dragging = false;
    let dy = 0;

    const start = (e: TouchEvent) => {
      if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
      startY = e.touches[0].clientY;
      dragging = true;
      dy = 0;
      el.style.transition = "none";
    };
    const move = (e: TouchEvent) => {
      if (!dragging || startY == null) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        // Pulling up — hand control back to normal list scrolling.
        el.style.transform = "";
        return;
      }
      if ((scrollRef.current?.scrollTop ?? 0) > 0) {
        dragging = false;
        el.style.transform = "";
        return;
      }
      e.preventDefault();
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = "transform 0.2s ease-out";
      if (dy > 120) {
        el.style.transform = "translateY(100%)";
        window.setTimeout(onClose, 180);
      } else {
        el.style.transform = "";
      }
      startY = null;
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [onClose]);

  function openVendor(id: string) {
    // `from` returns the back button here: /explore?restore=1 reopens this sheet
    // and restores the map view (see explore/page.tsx).
    router.push(`/vendor/${id}?from=${encodeURIComponent("/explore?restore=1")}`);
  }

  const heading = `${ids.length} ${CATEGORY_PLURAL[vendorType]} available`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl bg-background shadow-xl animate-in slide-in-from-bottom-8 fade-in-0 duration-200"
      >
        {/* Grab handle (also the primary swipe-down target) */}
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <div
            className="h-1.5 w-10 rounded-full bg-muted-foreground/30"
            aria-hidden
          />
        </div>

        {/* Header: count + close */}
        <div className="flex shrink-0 items-center gap-2 border-b px-4 pb-3 pt-1">
          <h2 className="min-w-0 flex-1 font-heading text-base font-semibold">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close list"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable feed */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        >
          {items === null ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  // Native content-visibility virtualization: off-screen cards
                  // skip layout/paint, so a few-hundred-item feed stays smooth.
                  className="[content-visibility:auto] [contain-intrinsic-size:auto_300px]"
                >
                  <button
                    type="button"
                    onClick={() => openVendor(item.id)}
                    className="block w-full overflow-hidden rounded-xl border bg-card text-left transition-colors hover:bg-muted/40"
                  >
                    <ClusterCardPhoto
                      candidates={item.photoCandidates}
                      vendorType={vendorType}
                      alt={item.name}
                    />
                    <div className="flex flex-col gap-0.5 px-3 py-2.5">
                      <span className="block truncate font-heading text-sm font-semibold">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {reconLabel(item.reconCount)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function reconLabel(n: number): string {
  if (n === 0) return "No recon yet";
  if (n === 1) return "1 recon entry";
  return `${n} recon entries`;
}

/**
 * Card photo with an ordered fallback chain (Google → recon → placeholder).
 * `loading="lazy"` keeps off-screen images off the network until scrolled near.
 */
function ClusterCardPhoto({
  candidates,
  vendorType,
  alt,
}: {
  candidates: string[];
  vendorType: VendorType;
  alt: string;
}) {
  const [idx, setIdx] = React.useState(0);
  const category = CATEGORIES[vendorType];
  const src = candidates[idx];

  if (!src) {
    const Icon = category.icon;
    return (
      <div
        className="flex aspect-[16/10] w-full items-center justify-center"
        style={{ backgroundColor: category.lightHex, color: category.textHex }}
        aria-hidden
      >
        <Icon className="size-8 opacity-70" />
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
      className="aspect-[16/10] w-full bg-muted object-cover"
    />
  );
}
