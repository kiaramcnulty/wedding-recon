# Photo rules — caterers

Sourcing: the caterer's OWN website only (photos.mjs enforces this by construction).
NEVER re-host The Knot / Zola / WeddingWire gallery images or Google Places photos
(ToS forbids caching). Keep `manifest.json` source_url for every file.

Target: **1-2 photos of FOOD specifically** (Kiara, 2026-07) on entries where qualifying
images exist. Coming in under target is always better than including a non-qualifying
image; caterers can ship with zero photos.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its
`_thumb.jpg` and decide:

KEEP only if it clearly shows:
- the food itself: plated dishes, buffet/station spreads, passed apps, dessert displays
- their service in action: food-truck setup, carving/action stations, staffed buffet
- real information: a menu with prices, a package sheet

ALWAYS DROP:
- logos, wordmarks, badges, award graphics, "featured on" banners
- staff or chef portraits (an about-page headshot is not food)
- couple/bridal-party portraits (people-as-subject; a wide reception shot where the
  buffet is the subject is fine)
- venue/tablescape shots with no food visible (that's venue or florist content)
- stock-photo-looking images and photographer-WATERMARKED images (copyright flag AND a
  scraped-content tell)
- blurry screenshots and video stills

Borderline? Drop it.

## Mechanics
Same as venues: `photos.mjs --type caterer` writes `photos/<slug>/NN.jpg` + `NN_thumb.jpg`
(~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`. The portrait-URL
pre-filter is ON for this type. CSV `photos` column: `;`-separated workdir-relative paths.
Never map the same file to two entries; for multi-entry vendors the photos-map step
attaches photos to the FIRST entry only.
