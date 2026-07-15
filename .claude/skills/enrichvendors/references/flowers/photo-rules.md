# Photo rules — florists

Sourcing: the florist's OWN website only (photos.mjs enforces this by construction).
NEVER re-host The Knot / Zola / WeddingWire gallery images or Google Places photos
(ToS forbids caching). Keep `manifest.json` source_url for every file.

Target: **1-2 arrangement photos** (Kiara, 2026-07) on entries where qualifying images
exist. Coming in under target is always better than including a non-qualifying image;
florists can ship with zero photos.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its
`_thumb.jpg` and decide:

KEEP only if it clearly shows their floral work:
- bouquets, boutonnieres, centerpieces, ceremony arches/arbors, installations,
  tablescape shots where the florals are the subject
- real information: an a-la-carte menu with prices, a package sheet

ALWAYS DROP:
- logos, wordmarks, badges, award graphics, "featured on" banners
- staff/owner portraits
- couple/bridal-party portraits where people are the subject (a bride HOLDING a bouquet
  is a photographer's shot; a bouquet close-up is the florist's)
- storefront/shop-exterior shots (says nothing about the work)
- photographer-WATERMARKED images — most florist galleries are professional wedding
  photographers' shots; if the whole gallery is one photographer's watermarked set, the
  florist ships photo-less (same precedent as venues)
- blurry screenshots and video stills

Borderline? Drop it.

## Mechanics
Same as venues: `photos.mjs --type flowers` writes `photos/<slug>/NN.jpg` + `NN_thumb.jpg`
(~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`. The portrait-URL
pre-filter is ON for this type. CSV `photos` column: `;`-separated workdir-relative paths.
Never map the same file to two entries; for multi-entry vendors the photos-map step
attaches photos to the FIRST entry only.
