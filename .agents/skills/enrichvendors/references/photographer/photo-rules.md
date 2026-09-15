# Photo rules — photographers

Sourcing: the photographer's OWN website only (photos.mjs enforces this by construction —
it only downloads URLs harvested from their site). NEVER re-host The Knot / Zola /
WeddingWire gallery images or Google Places photos (ToS forbids caching). Kiara has
photographer feedback that re-hosting their own portfolio WITH CREDIT is welcome
advertising — provenance stays mandatory: keep `manifest.json` source_url for every file.

Target: **~3 photos per photographer that has that many qualifying images** (Kiara,
2026-07 — photos are critical for this vendor type; this is a higher bar than venues).
Coming in under target is still always better than including a non-qualifying image;
photographers can ship with fewer or zero.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its
`_thumb.jpg` and decide:

KEEP only if it clearly shows their wedding work:
- couples, ceremonies, receptions, first looks, portraits — **people-as-subject is the
  PRODUCT here** (inverse of the venue rule)
- editorial/landscape wedding shots (mountain elopements etc.)
- the photographer's OWN watermark is fine — it's their credit, not a copyright flag
  (inverse of the venue rule; on their own site it's self-attribution)

ALWAYS DROP:
- logos, wordmarks, award badges, "featured on" graphics, title cards
- the photographer's self-portrait/headshot (about-page portrait of the *photographer*
  is not portfolio work; a couple portrait is)
- OTHER vendors' work embedded in blog posts (venue marketing shots, florist close-ups
  with no people) — when ambiguous, drop
- non-wedding sessions (newborn, corporate headshots, product)
- blurry screenshots, video stills, anything under quality bar

Borderline? Drop it.

## Mechanics
Same as venues: `photos.mjs --type photographer` writes `photos/<slug>/NN.jpg` +
`NN_thumb.jpg` (~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`.
For photographers run with `--per-venue 5` so the eyeball pass can keep ~3. The
portrait-URL pre-filter is OFF for this type (profile.portraitFilter=false). CSV
`photos` column: `;`-separated workdir-relative paths. Never map the same file to two
entries.
