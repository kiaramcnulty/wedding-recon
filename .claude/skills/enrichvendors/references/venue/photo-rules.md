# Photo rules

Sourcing: the venue's OWN website only (photos.mjs enforces this by construction — it only
downloads URLs harvested from the venue site). NEVER re-host The Knot / Zola / WeddingWire
gallery images (typically photographer-owned; takedown risk) or Google Places photos
(ToS forbids caching).

Target: 1-2 photos on ~75% of entries. **Coming in under target is always better than
including a non-qualifying image.** Venues can ship with zero photos.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into recons.csv, Read (view) its
`_thumb.jpg` and decide:

KEEP only if it clearly shows:
- the venue itself: interior spaces, grounds, buildings, ceremony/reception setups, aerials
- OR real information: pricing sheet, floor plan, capacity chart

ALWAYS DROP:
- logos, wordmarks, badges, award graphics ("1% For The Planet", venue logo cards)
- digital artwork / promo graphics / title cards ("The venue with a past")
- staff or owner portraits
- photographer-WATERMARKED images (e.g. a "CAKEKNIFE" corner mark) — copyright flag AND a
  scraped-content tell. If a venue's whole gallery is one photographer's watermarked set,
  the venue ships photo-less (pilot precedent: Dunafon Castle)
- close-up couple/bridal-party portraits (identifiable people as the subject).
  Wide venue shots where a crowd/ceremony is incidental are fine.
- blurry screenshots and video stills unless they're the only shot of the venue itself

Borderline? Drop it.

## Mechanics
- `photos.mjs` writes `photos/<slug>/NN.jpg` + `NN_thumb.jpg` (app convention: ~1600px
  full / ~400px thumb JPEG) and `manifest.json` with per-photo `source_url` provenance —
  keep that manifest; it's the answer to any future complaint.
- Wix/Shopify sites serve downsized CDN URLs; photos.mjs auto-upgrades them. If a venue
  yields few keepers, re-run with `--per-venue 8` and/or fetch its dedicated
  weddings/gallery page images before giving up.
- CSV `photos` column: `;`-separated workdir-relative paths (`photos/<slug>/01.jpg`).
  Thumbs are derived automatically and must exist (validated).
- Photos of pricing sheets/screenshots belong on `online`-type entries.
- Never map the same photo file to two entries (two bots posting an identical photo is a tell).
