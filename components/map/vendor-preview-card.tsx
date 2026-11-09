"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import { formatVendorLocality } from "@/lib/vendor-locality";
import { sortReconEntries } from "@/lib/recon-sort";
import type { FilterSelection, VendorFilters } from "@/lib/filters/match";
import { vendorTags } from "@/lib/filters/vendor-tags";
import { VendorTagPreview } from "@/components/vendor/vendor-tags";
import { VerifiedBadge } from "@/components/vendor/verified-badge";
import { cn } from "@/lib/utils";

/**
 * The vendor preview card + its data fetch, shared by FOUR surfaces: the three
 * map ones (cluster list feed `cluster-list-sheet.tsx`, on-screen results feed
 * `vendor-list-sheet.tsx`, single-pin peek `vendor-pin-preview.tsx`) and the
 * Planning Hub (`hub-accordion.tsx`). One card shape, one query — change the
 * card here and all four move together.
 *
 * Two props flex it per surface without forking it: `showCategoryPill` (off in
 * the Hub, where cards already sit inside a category accordion) and `action`
 * (a trailing control — the Hub's edit/add button; the map passes none).
 * Shape since 2026-11-08: a photo strip on top, then name and town, tags and
 * the recon count, with no recon-entry text.
 */

/**
 * Google photos per vendor the card may show: mirrors `MAX_PHOTOS` in
 * lib/google-photos.ts (a server module the client cannot import). Each is a
 * billed Place Photos fetch the first time, then edge-cached, and they are the
 * same `i`/`w` keys the vendor page strip requests, so a card and the page
 * share one fetch per photo.
 */
const GOOGLE_PHOTO_CAP = 2;
/** Photos in one card's strip, all sources together. */
const CARD_PHOTO_CAP = 10;

export interface VendorPreview {
  id: string;
  name: string;
  /** "City, ST" subtitle under the name; null when the row has no usable place. */
  locality: string | null;
  reconCount: number;
  /**
   * Every photo for the card's strip, in order: a verified vendor's own
   * uploads first, then recon photos (both free Supabase reads, in recon sort
   * order), then Google's (billed, see GOOGLE_PHOTO_CAP). A photo that fails
   * to load drops out; with none left the card shows a category placeholder.
   */
  photos: string[];
  /** The vendor's raw filter attributes, for the tag pills. */
  filters: VendorFilters;
  /**
   * Vendor Verification: a paying, verified vendor gets the badge. Resolved by a
   * separate `verified_vendor_ids` RPC (see the fetch below), not from the
   * vendor row — a plain table select cannot read the deny-all subscriptions
   * table under caller RLS.
   */
  verified: boolean;
}

/** Minimal row shapes for the on-tap detail fetch (client queries are untyped). */
interface VendorLite {
  id: string;
  name: string;
  google_photos: unknown[] | null;
  google_place_id: string | null;
  city: string | null;
  region: string | null;
  address_text: string | null;
  filters: VendorFilters;
}
interface ReconRow {
  vendor_id: string;
  author_id: string;
  // The price fields are read by sortReconEntries (priced entries first).
  price_text: string | null;
  price_details: string | null;
  // Read by sortReconEntries — the collected date is the recency it orders on,
  // with created_at as the tiebreak and the fallback for pre-migration rows.
  recon_collected_month: number | null;
  recon_collected_year: number | null;
  created_at: string | null;
  media: { thumb_path: string | null; storage_path: string }[] | null;
}

/**
 * Fetch preview data for a set of vendor ids. Returns null while in flight, then
 * the built previews in the *given id order* (ids whose vendor row is gone are
 * dropped). Three client queries, no RPC/migration: the vendor rows, their
 * active recon entries with media (tallied for the count + a fallback
 * thumbnail), and the viewer's identity so their own recon sorts first.
 *
 * The identity check is `getClaims()` — a local JWT verify, no round trip on a
 * project with asymmetric signing keys. Explore is public, so a signed-out
 * viewer is normal: `viewerId` is simply null and the "mine first" key and the
 * tag are both no-ops (the price and recency keys still apply).
 */
/** Ceiling on the per-session preview cache before it is dropped wholesale. */
const PREVIEW_CACHE_MAX = 600;

export function useVendorPreviews(ids: string[]): VendorPreview[] | null {
  // Previews already fetched this session, keyed by vendor id.
  //
  // This used to be plain state that the effect reset to null on every change
  // of the id list, which made the feed unusable in two ways. The whole list
  // blanked to a spinner whenever the set shifted — including when the caller
  // merely GREW it, so paging in more rows threw away everything on screen —
  // and every fetch re-asked for vendors it already had. Caching by id means a
  // request only ever covers ids genuinely not seen yet.
  // Split deliberately across state and a ref, because the two are read at
  // different times. `cache` holds the data the render reads, so it must be
  // state (a ref cannot be read during render). `fetchedRef` is bookkeeping the
  // EFFECT reads to work out what is missing — keeping it in a ref is what lets
  // the effect depend on `idsKey` alone instead of on the cache it just wrote,
  // which would loop.
  const [cache, setCache] = React.useState<ReadonlyMap<string, VendorPreview>>(
    () => new Map(),
  );
  const fetchedRef = React.useRef(new Set<string>());

  // Stable key so the fetch effect doesn't re-run on array identity changes.
  const idsKey = ids.join(",");

  React.useEffect(() => {
    let cancelled = false;
    const wanted = idsKey ? idsKey.split(",") : [];
    // Only the ids we have never fetched. This is what keeps a "load 20 more"
    // request proportional to the page rather than to the whole list.
    const idList = wanted.filter((id) => !fetchedRef.current.has(id));
    // Nothing new to ask for: the render below already derives from the cache,
    // so there is no state to set here (and setting it synchronously in an
    // effect would be a cascading render).
    if (idList.length === 0) return;
    (async () => {
      const supabase = createClient();
      const [vendorsRes, reconRes, claimsRes, verifiedRes, overridesRes] = await Promise.all([
        supabase
          .from("vendors")
          // city/region/address_text feed the "City, ST" subtitle — three small
          // text columns on rows already being fetched, so no extra round trip.
          .select(
            "id, name, google_photos, google_place_id, city, region, address_text, filters",
          )
          .in("id", idList),
        supabase
          .from("recon_entries")
          .select(
            "vendor_id, author_id, price_text, price_details, recon_collected_month, recon_collected_year, created_at, media:recon_media(thumb_path, storage_path)",
          )
          .eq("status", "active")
          .in("vendor_id", idList)
          .order("created_at", { ascending: false }),
        supabase.auth.getClaims(),
        // Which of these ids are verified vendors. A SECURITY DEFINER set
        // function (migration 0044), because the perks rule reads the deny-all
        // subscriptions table a plain select cannot touch. An error here (the
        // RPC not yet applied) is treated as "nobody verified" so the card is
        // exactly what it is today — same never-throw stance as searchVendors.
        supabase.rpc("verified_vendor_ids", { p_ids: idList }),
        // A verified vendor's own published details (migration 0044), merged
        // over the extracted filters below exactly as the map route and the
        // vendor page merge them. Without this a card could say "A la carte"
        // for a florist the matcher, reading the vendor's own "full service
        // only", had just ranked as a full-service match. Same never-throw
        // stance: an error leaves the extracted filters as they are.
        supabase.rpc("verified_listing_overrides", { p_ids: idList }),
      ]);
      if (cancelled) return;

      const vendors = (vendorsRes.data ?? []) as unknown as VendorLite[];
      const recons = (reconRes.data ?? []) as unknown as ReconRow[];
      const viewerId = claimsRes.data?.claims.sub ?? null;
      const verifiedIds = new Set<string>(
        ((verifiedRes.data ?? []) as { vendor_id: string }[]).map(
          (r) => r.vendor_id,
        ),
      );

      const overridesById = new Map<string, Record<string, unknown>>();
      for (const r of (overridesRes.data ?? []) as {
        vendor_id: string;
        filter_overrides: Record<string, unknown> | null;
      }[]) {
        if (r.filter_overrides && Object.keys(r.filter_overrides).length) {
          overridesById.set(r.vendor_id, r.filter_overrides);
        }
      }
      // A verified vendor's own first photo leads its card (Kiara, 2026-11-04):
      // the portal tells them their photos lead their listing, and the card is
      // where most couples first see it. Only verified ids are asked, so this
      // is zero calls on most batches. verified_listing_public (0046) because
      // vendor_listings has no anon select (drafts must never leak); it takes
      // one id, hence one call per verified vendor. An error simply leaves the
      // card on its recon / Google candidates.
      const vendorPhotos = new Map<string, string[]>();
      await Promise.all(
        [...verifiedIds].map(async (vid) => {
          const { data } = await supabase.rpc("verified_listing_public", {
            p_vendor_id: vid,
          });
          const photos =
            (data as { photos: { thumb_path?: string; storage_path?: string }[] | null }[] | null)?.[0]
              ?.photos ?? [];
          const urls = photos.flatMap((ph) => {
            const path = ph.thumb_path ?? ph.storage_path;
            return path ? [supabase.storage.from("vendor-media").getPublicUrl(path).data.publicUrl] : [];
          });
          if (urls.length) vendorPhotos.set(vid, urls);
        }),
      );
      if (cancelled) return;

      const vendorById = new Map<string, VendorLite>();
      for (const v of vendors) vendorById.set(v.id, v);

      // Sorted ONCE over the flat result, before anything is grouped, so the
      // count, the fallback thumbnail and the slides all follow one order — and
      // it is the same order the vendor page uses. Bucketing by vendor_id below
      // preserves the relative order inside each vendor's rows, which is the
      // only ordering that matters here.
      const ordered = sortReconEntries(recons, viewerId);

      // Tally active recon counts and collect every recon photo per vendor.
      const counts = new Map<string, number>();
      const reconPhotos = new Map<string, string[]>();
      for (const row of ordered) {
        counts.set(row.vendor_id, (counts.get(row.vendor_id) ?? 0) + 1);
        for (const m of row.media ?? []) {
          const path = m.thumb_path ?? m.storage_path;
          if (!path) continue;
          const list = reconPhotos.get(row.vendor_id) ?? [];
          list.push(supabase.storage.from("recon-media").getPublicUrl(path).data.publicUrl);
          reconPhotos.set(row.vendor_id, list);
        }
      }

      // Preserve the caller's id order; drop ids whose vendor row is gone.
      const built: VendorPreview[] = idList.flatMap((id) => {
        const v = vendorById.get(id);
        if (!v) return [];
        // The vendor's own photos, then recon photos (2026-08: free Supabase
        // reads, and the vendor page strip also leads with recon), then Google.
        const photos = [...(vendorPhotos.get(id) ?? []), ...(reconPhotos.get(id) ?? [])];
        // Google: as many as the row has cached (up to the cap), or just the
        // first when it has a place but no cached list yet, exactly the one
        // photo cards asked for before. w=600 is the vendor page strip width,
        // so the two share one billed fetch and CDN entry per photo.
        const googleCount = v.google_photos?.length
          ? Math.min(v.google_photos.length, GOOGLE_PHOTO_CAP)
          : v.google_place_id
            ? 1
            : 0;
        for (let i = 0; i < googleCount; i++) photos.push(`/api/vendor-photo/${id}?i=${i}&w=600`);
        return [
          {
            id,
            name: v.name,
            locality: formatVendorLocality(v),
            reconCount: counts.get(id) ?? 0,
            photos: photos.slice(0, CARD_PHOTO_CAP),
            // Override keys win; extracted keys survive where not set.
            filters: overridesById.has(id)
              ? { ...(v.filters ?? {}), ...overridesById.get(id) }
              : (v.filters ?? null),
            verified: verifiedIds.has(id),
          },
        ];
      });

      if (cancelled) return;
      // Mark every id we ASKED for, not just the ones that came back: a vendor
      // row that is gone must not be re-requested on every subsequent render.
      for (const id of idList) fetchedRef.current.add(id);
      setCache((prev) => {
        // Bound the session cache. Panning a map for a while would otherwise
        // accumulate every vendor ever previewed; dropping it wholesale is fine
        // because the next render simply refetches the ids on screen.
        const overflowing = prev.size + built.length > PREVIEW_CACHE_MAX;
        if (overflowing) fetchedRef.current = new Set(idList);
        const next = overflowing
          ? new Map<string, VendorPreview>()
          : new Map(prev);
        for (const item of built) next.set(item.id, item);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return React.useMemo(() => {
    const wanted = idsKey ? idsKey.split(",") : [];
    const built = wanted.flatMap((id) => cache.get(id) ?? []);
    // Null (the caller's spinner) only while we have NOTHING to show. Once any
    // row has landed the feed renders what it has and fills in the rest as it
    // arrives, which is what makes paging feel additive instead of destructive.
    // An id with no cache entry is either still in flight or a vendor row that
    // is gone; both correctly render as absent rather than as a gap.
    if (built.length === 0 && wanted.length > 0) return null;
    return built;
  }, [idsKey, cache]);
}

/**
 * One vendor preview (Kiara, 2026-11-08): a swipeable strip of every photo
 * across the top, then name and town, the tag pills, and the recon count. No
 * recon-entry text: the photos take the room it used, at the same card height.
 * Tapping anywhere opens the vendor page; a swipe never does.
 */
export function VendorPreviewCard({
  item,
  vendorType,
  href,
  onNavigate,
  showCategoryPill = true,
  selection,
  action,
  cornerAction,
  className,
}: {
  item: VendorPreview;
  vendorType: VendorType;
  /**
   * The vendor page this card opens, including any `from` return path.
   *
   * A real href, not an onClick — that is what makes it a `<Link>`, and the
   * Link is what gets `/vendor/[id]`'s `loading.tsx` prefetched. As a button
   * calling router.push, Next did not know the route had a loading boundary
   * until the whole RSC response arrived, so a tap sat there doing visibly
   * nothing (~800ms locally, and longer on a phone where the card photos are
   * competing for bandwidth — which is what made it look like the card was not
   * clickable until its photo loaded). Same lesson as /recon/[id]/edit.
   */
  href: string;
  /** Side effect to run before navigating (e.g. saving feed scroll position). */
  onNavigate?: () => void;
  /** Hidden in the Hub, where cards already sit under a category accordion. */
  showCategoryPill?: boolean;
  /**
   * The couple's active filters for THIS vendor's type, if any. Only reorders
   * the tag pills (matched ones float first); never adds or removes one. The
   * surfaces without a filter notion (the Hub) pass nothing.
   */
  selection?: FilterSelection;
  /**
   * Optional trailing control (the Hub's edit/add button). Rendered as a
   * SIBLING of the main button, never inside it — nesting an interactive
   * element in a button is invalid and swallows its taps.
   */
  action?: React.ReactNode;
  /**
   * Optional small control pinned to the card's top-right corner (the save
   * heart). Floated rather than given its own column, which would take the
   * full card height of width from the name and the tag pills; the text column
   * only gives up a heart's width. A sibling of the Link, positioned against
   * the card.
   */
  cornerAction?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const category = CATEGORIES[vendorType];
  const CategoryIcon = category.icon;
  const tags = React.useMemo(
    () => vendorTags(vendorType, item.filters, selection),
    [vendorType, item.filters, selection],
  );

  /** Same destination as the Link, for the photo strip above it. */
  const go = () => {
    onNavigate?.();
    router.push(href);
  };

  return (
    // The scrollable strip can't live inside the main control, so the card is
    // a div: swipeable photos on top, the link below.
    <div
      className={cn(
        // hover must stay OPAQUE: the single-pin peek card floats directly over
        // the map, so a translucent hover (bg-muted/40) let the basemap's roads
        // and town labels bleed through and made the card unreadable on web
        // (reported 2026-08-12). --muted is oklch(0.97 0 0), a near-white that
        // reads as the same subtle tint the /40 intended, but fully opaque.
        "relative overflow-hidden rounded-xl transition-colors",
        // A verified vendor's card carries the Vendor Verification tint, on
        // every surface this card renders (feed, cluster sheet, pin peek, Hub).
        // Both fills are opaque tokens, for the same reason as above.
        item.verified
          ? "border-[1.5px] border-verified-line bg-verified-soft hover:bg-verified-wash"
          : "border bg-card hover:bg-muted",
        className,
      )}
    >
      <div className="relative">
        <PhotoStrip photos={item.photos} vendorType={vendorType} alt={item.name} onOpen={go} />
        {/* Bottom-left: the pin card's close button sits on the top-left
            corner, and the save heart on the top-right. */}
        {showCategoryPill && (
          <span
            className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm"
            style={{ backgroundColor: category.lightHex, color: category.textHex }}
          >
            <CategoryIcon className="size-3 shrink-0" />
            {category.label}
          </span>
        )}
        {cornerAction && <div className="absolute right-2 top-2">{cornerAction}</div>}
      </div>
      <div className="flex items-stretch">
        <Link
          href={href}
          onClick={onNavigate}
          // `no-underline!` is required, not cosmetic: in the Hub this card sits
          // inside AccordionContent, which underlines every descendant anchor
          // with `[&_a]:underline` — a selector that out-specifies a plain
          // utility. Same gotcha as the Hub's "Add" action link.
          className="flex min-w-0 flex-1 flex-col gap-1 px-3 pb-2.5 pt-2 text-left no-underline!"
        >
          {/* Name, verified badge and town on one line. The badge and town are
              siblings of the truncating name so only the name gives way; the
              town is "City, ST" of the address behind the pin, for every type. */}
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 truncate font-heading text-sm font-semibold">{item.name}</span>
            {item.verified && <VerifiedBadge compact className="self-center" />}
            {item.locality && (
              <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0 self-center" aria-hidden />
                {item.locality}
              </span>
            )}
          </span>
          {/* One clipped line of filter tags; none when the vendor has no known
              facets. */}
          {tags.length > 0 && <VendorTagPreview tags={tags} />}
          <span className="text-xs text-muted-foreground">{reconLabel(item.reconCount)}</span>
        </Link>
        {action && <div className="flex shrink-0 items-center pl-1 pr-2">{action}</div>}
      </div>
    </div>
  );
}

/**
 * The card's photos as one horizontal, snapping strip. Native scroll does the
 * swiping (a host sheet's swipe-down yields via its axis lock), and browsers do
 * not fire click after a scroll gesture, so a tap opens the vendor page and a
 * swipe never does. Tiles peek the next photo as the swipe affordance.
 *
 * Every photo shows whole, at its own aspect ratio and the strip height: never
 * cropped or stretched (Kiara, 2026-11-08), so a short strip can leave
 * whitespace. Only the photos in view (plus the next) load up front; the rest
 * mount as the strip is swiped toward them. A feed of 20 cards would otherwise ask for up to 200
 * images, and the Google ones are billed.
 */
function PhotoStrip({
  photos,
  vendorType,
  alt,
  onOpen,
}: {
  photos: string[];
  vendorType: VendorType;
  alt: string;
  onOpen: () => void;
}) {
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(() => new Set());
  const [loaded, setLoaded] = React.useState<ReadonlySet<string>>(() => new Set());
  const [reach, setReach] = React.useState(2);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const shown = photos.filter((p) => !failed.has(p));
  const category = CATEGORIES[vendorType];

  // Mount every photo whose tile has come into view, plus the next one. Tiles
  // are as wide as their photo, so this is measured, not counted: run on
  // scroll, and after each load (three portraits can fit where one landscape
  // did).
  const extendReach = () => {
    const el = stripRef.current;
    if (!el) return;
    const edge = el.scrollLeft + el.clientWidth;
    const inView = [...el.children].filter((c) => (c as HTMLElement).offsetLeft < edge).length;
    if (inView + 1 > reach) setReach(inView + 1);
  };

  if (shown.length === 0) {
    const Icon = category.icon;
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={onOpen}
        aria-hidden
        className="flex h-32 w-full items-center justify-center"
        style={{ backgroundColor: category.lightHex, color: category.textHex }}
      >
        <Icon className="size-8 opacity-60" />
      </button>
    );
  }
  return (
    <div
      ref={stripRef}
      onClick={onOpen}
      onScroll={extendReach}
      // One photo sits centred; several run left to right. Either way the
      // leftover width stays card-coloured rather than being filled by
      // cropping (Kiara, 2026-11-08: show the whole photo).
      className={cn(
        "flex h-32 cursor-pointer snap-x snap-mandatory gap-0.5 overflow-x-auto",
        shown.length === 1 && "justify-center",
      )}
      style={{ scrollbarWidth: "none" }}
    >
      {shown.map((src, i) => (
        <div
          key={src}
          // As wide as the photo at the strip height, so nothing is cropped or
          // stretched. Capped at the strip width: a panorama wider than that
          // is shown whole, letterboxed, instead of cut. Until it loads, a
          // grey tile holds its place.
          className={cn(
            "flex h-full max-w-full shrink-0 snap-start items-center",
            !loaded.has(src) && "w-40 bg-muted",
          )}
        >
          {i < reach && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={i === 0 ? alt : ""}
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={() => {
                setLoaded((l) => new Set(l).add(src));
                requestAnimationFrame(extendReach);
              }}
              onError={() => setFailed((f) => new Set(f).add(src))}
              className={cn("h-full w-auto max-w-full object-contain", !loaded.has(src) && "opacity-0")}
            />
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
