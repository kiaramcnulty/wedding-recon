# Photo rules — music acts

Sourcing: the act's OWN website only (photos.mjs enforces this by construction).
NEVER re-host The Knot / Zola / WeddingWire gallery images or Google Places photos
(ToS forbids caching). Keep `manifest.json` source_url for every file.

Target: **1-2 performance shots** on entries where qualifying images exist. Coming in
under target is always better than including a non-qualifying image; acts can ship with
zero photos.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its
`_thumb.jpg` and decide:

KEEP only if it clearly shows the act at work:
- the band/DJ/musicians performing — on stage, at a reception, ceremony musicians
  playing. **The performers as subject is the PRODUCT here** (portrait pre-filter is OFF)
- full-band/act promo shots with instruments
- their setup at an event (DJ booth, dance floor lighting they provided)
- real information: a package/pricing sheet

ALWAYS DROP:
- logos, wordmarks, badges, award graphics, title cards
- individual member headshots (a full-act promo shot is portfolio; one person's
  about-page headshot is not)
- couple/guest close-ups where the act isn't the subject (dancing crowds are fine only
  when the band/DJ is clearly the subject)
- other vendors' work (venue marketing shots, decor close-ups)
- photographer-WATERMARKED images from someone else's portfolio
- blurry screenshots and video stills unless they're the only shot of the act performing

Borderline? Drop it.

## Mechanics
Same as venues: `photos.mjs --type music` writes `photos/<slug>/NN.jpg` + `NN_thumb.jpg`
(~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`. The portrait-URL
pre-filter is OFF for this type (profile.portraitFilter=false — performers are people).
CSV `photos` column: `;`-separated workdir-relative paths. Never map the same file to two
entries; for multi-entry vendors the photos-map step attaches photos to the FIRST entry only.
