# Photo rules — wedding planners

Sourcing: the planner's OWN website only (photos.mjs enforces this by construction).
NEVER re-host The Knot / Zola / WeddingWire gallery images or Google Places photos (ToS
forbids caching). A planner's portfolio images were shot by hired photographers and shown
with license — same as venue/dress photos; keep `manifest.json` source_url for every file
so provenance stays intact.

Target: **1-2 portfolio shots** on entries where qualifying images exist. Coming in under
target is always better than including a non-qualifying image; planners can ship with zero.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its
`_thumb.jpg` and decide:

KEEP only if it clearly shows a wedding they PRODUCED — the styled, coordinated event is
the product here (portrait pre-filter is OFF):
- ceremony and reception scenes they designed/ran, tablescapes, decor and styling details,
  the couple and guests in a wedding they coordinated
- real information: a package/pricing or services sheet

ALWAYS DROP:
- logos, wordmarks, badges, "as seen in"/"featured on" graphics, title cards
- the planner's own headshot / about-page portrait of the planner (that's not portfolio
  work; a couple they styled is)
- other vendors' isolated product shots with no event context (a bare bouquet close-up, a
  cake on white, a venue's empty-room marketing shot) — when ambiguous, drop
- stock imagery, mood-board collages, blurry screenshots, video stills

Borderline? Drop it.

## Mechanics
Same as venues: `photos.mjs --type planner` writes `photos/<slug>/NN.jpg` + `NN_thumb.jpg`
(~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`. The portrait-URL
pre-filter is OFF for this type (profile.portraitFilter=false — the couple/scene IS the
work). CSV `photos` column: `;`-separated workdir-relative paths. Never map the same file
to two entries; for multi-entry vendors the photos-map step attaches photos to the FIRST
entry only.
