"use client";

import { PhotoLightbox, type LightboxPhoto } from "@/components/vendor/photo-lightbox";

/**
 * Every photo on a vendor page, in ONE horizontal strip.
 *
 * It used to be two stacked strips — Google Places photos, then a separate
 * carousel of the ones couples uploaded with their recon — kept apart so
 * community snaps never read as official marketing. They rendered identical
 * tiles, though, so the split was invisible: it just looked like two rows of the
 * same thing, and together with the map it ate the whole first screen before any
 * recon was reachable (Kiara, 2026-08-04). Provenance is now carried per-tile by
 * a "Google" chip, which is a clearer signal than a row break ever was, and it
 * buys back ~170px.
 *
 * Recon photos lead. They are the differentiated content — evidence a real
 * couple actually went — and most vendors have none, so on the common page this
 * is identical to leading with Google.
 *
 * One strip also means one lightbox sequence: opening any photo now pages
 * through all of them instead of stopping at the row boundary.
 *
 * Photos are large and whole (Kiara, 2026-11-28, after the preview cards got
 * the same treatment): each tile is TILE_HEIGHT tall and as wide as its photo
 * at that height, so nothing is cropped. With more than one photo a tile is
 * capped short of the strip width so the next one always peeks, which is the
 * only hint that the strip scrolls.
 */
const TILE_HEIGHT = 240;
interface VendorPhotosProps {
  vendorId: string;
  /** How many Google photos were resolved server-side. */
  googleCount: number;
  /** Combined Google author attribution (may be null). */
  googleCredit: string | null;
  /** Photos attached to this vendor's recon entries. */
  reconPhotos: LightboxPhoto[];
  /** A verified vendor's own uploaded photos (badged), between recon and Google. */
  vendorPhotos?: LightboxPhoto[];
}

export function VendorPhotos({
  vendorId,
  googleCount,
  googleCredit,
  reconPhotos,
  vendorPhotos = [],
}: VendorPhotosProps) {
  // w=600 is the same key the preview cards fetch, so the strip costs no Google
  // fetch a card has not already paid for. At 240px tall a 4:3 photo is 320
  // CSS px wide, so 600 is ~1.9x density, the same as an uploaded photo at its
  // medium size. The 1200px variant is fetched only when a photo is opened.
  const googlePhotos: LightboxPhoto[] = Array.from(
    { length: googleCount },
    (_, i) => ({
      thumb: `/api/vendor-photo/${vendorId}?i=${i}&w=600`,
      full: `/api/vendor-photo/${vendorId}?i=${i}&w=1200`,
      badge: "Google",
    }),
  );

  // Order: recon photos (community evidence) lead, then the vendor's own
  // uploads, then Google. Recon stays first on purpose — the page's job is to
  // get the reader to the recon, and community content should not read as the
  // vendor's marketing.
  //
  // Uploaded photos show their ~600px medium where one exists (migration
  // 0053): the 400px thumb is soft at 240px tall on a 3x screen, and the
  // 1600px full is ten times the bytes. Rows from before it fall back to the
  // thumb until the backfill reaches them.
  const photos = [...reconPhotos, ...vendorPhotos, ...googlePhotos].map((p) =>
    p.medium ? { ...p, thumb: p.medium } : p,
  );
  if (photos.length === 0) return null;

  return (
    <div>
      <PhotoLightbox
        photos={photos}
        alt="Vendor photo"
        // scroll-px-4 matches the px-4 gutter: without it snap-mandatory aligns
        // the first tile to the container edge and scrolls the padding away, so
        // the strip bleeds to the screen edge while the rest of the page keeps
        // its 16px margin. (Same reason the map preview card uses scroll-pl-2.)
        // items-center: a panorama shrunk to the width cap is shorter than its
        // neighbours, and sits level with them rather than at the top.
        containerClassName="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory px-4 scroll-px-4 pb-2 scroll-smooth"
        containerStyle={{ scrollbarWidth: "none" }}
        tileClassName="snap-start rounded-xl ring-1 ring-foreground/10"
        tileHeight={TILE_HEIGHT}
        // 90% of a 390px phone's strip is 322px: a 4:3 photo (320px) still
        // fits at full height, and the next tile peeks ~45px.
        maxTileWidth={photos.length > 1 ? "90%" : "100%"}
      />
      {googleCount > 0 && (
        // Google's terms require showing the attributions returned with a photo.
        // Worded to credit the badged tiles specifically, since the strip now
        // also holds photos that are not theirs.
        <p className="px-4 pt-1 text-[11px] text-muted-foreground">
          {googleCredit ? `Google photos · ${googleCredit}` : "Photos via Google"}
        </p>
      )}
    </div>
  );
}
