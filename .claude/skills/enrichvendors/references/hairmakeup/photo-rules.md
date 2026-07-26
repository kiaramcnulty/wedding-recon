# Photo rules — hair & makeup artists

Sourcing: the artist's OWN website only (photos.mjs enforces this by construction — it only
downloads URLs harvested from their site). NEVER re-host The Knot / Zola / WeddingWire
gallery images or Google Places photos (ToS forbids caching). Keep `manifest.json`
source_url for every file.

Target: **2–3 CLOSE-UP shots of a bride or bridal-party member** where the hair and/or
makeup is the subject (Kiara, 2026-07 — photos carry this type; a couple of good close-ups
say more than any description). Run `photos.mjs --type hairmakeup --per-venue 5` so the
eyeball pass has enough to keep 2–3. Coming in under target is still better than including a
non-qualifying image; an artist can ship with fewer or zero.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its `_thumb.jpg`
and decide. The PRODUCT here is a person's FACE and HAIR, so `portraitFilter` is OFF for
this type — a bride's portrait is the portfolio, not junk (inverse of the venue/florist
rule). The test is **framing**: can you actually see the hair and makeup?

KEEP only if the hair/makeup is clearly the subject:
- a close or medium-close shot of a bride's face and/or hairstyle — the frame is the person,
  not the room
- the same for bridesmaids, mothers of the bride/groom, or flower girls (bridal-party work
  is in scope)
- a detail shot of an updo, braid, veil placement, hair accessory, or a finished makeup look
- a genuine before/after or getting-ready shot where the finished look is legible
- a real info card: a posted bridal price/service menu or travel-policy graphic

ALWAYS DROP:
- logos, wordmarks, badges, award graphics, "featured on" banners, title cards
- wide venue / ceremony / reception / dance-floor shots where the face is small — the hair
  and makeup aren't readable, so the image says nothing about their work
- the artist's own headshot or team portrait (that's the about page, not the portfolio);
  behind-the-scenes shots where the artist, not the finished look, is the subject
- salon-interior, chair, station, or product-flatlay shots
- other vendors' work that happens to be in frame (a gown-only shot, a bouquet close-up, a
  tablescape) — when ambiguous, drop
- non-wedding work that's clearly labeled as such (prom, headshots, editorial/costume,
  halloween/SFX), and lash-only / brow-only / nail / injectable before-and-afters
- blurry screenshots, video stills, heavily-filtered graphics, anything under the quality bar

Borderline? Drop it.

## Mechanics
Same as the other types: `photos.mjs --type hairmakeup` writes `photos/<slug>/NN.jpg` +
`NN_thumb.jpg` (~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`. The
portrait-URL pre-filter is OFF for this type (profile.portraitFilter=false), so the eyeball
pass does the whole judging. CSV `photos` column: `;`-separated workdir-relative paths.
Never map the same file to two entries; for multi-entry vendors the photos-map step attaches
photos to the FIRST entry only.
