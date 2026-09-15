# Photo rules — bridal shops

Sourcing: the shop's OWN website only (photos.mjs enforces this by construction — it only
downloads URLs harvested from their site). NEVER re-host The Knot / Zola / WeddingWire gallery
images or Google Places photos (ToS forbids caching). Keep `manifest.json` source_url for
every file.

Target: **1-2 gown photos** on entries where qualifying images exist. Coming in under target
is always better than including a non-qualifying image; bridal shops can ship with zero photos.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its `_thumb.jpg`
and decide. The PRODUCT here is the DRESS — and a wedding gown is almost always shown worn, so
`portraitFilter` is OFF for this type (a bride modeling a gown is NOT junk, unlike a florist's
bride-with-bouquet). Judge by whether the GOWN is the subject:

KEEP only if the DRESS is clearly the subject of their inventory:
- a wedding gown on a model, mannequin/dress-form, or a bride where the DRESS is the focus
- a flat-lay or rack shot of gowns, a close detail of a gown (lace, beading, train, back)
- bridesmaid / bridal-party dresses they sell (the garment is the subject)
- a real info card: a designer lookbook page, a price/sample-sale sheet

ALWAYS DROP:
- logos, wordmarks, badges, award graphics, "featured on" banners, title cards
- storefront / boutique-interior shots (says nothing about the gowns)
- staff / owner portraits
- couple / romance / first-look portraits where PEOPLE (not the dress) are the subject — that's
  a photographer's shot, not the shop's product; when ambiguous, drop
- other vendors' embedded work (venue or florist marketing shots in a blog post)
- photographer-WATERMARKED editorial where the gown isn't clearly this shop's inventory — if a
  whole gallery is one photographer's watermarked styled shoot, prefer the shop's own catalog
  images; ship photo-less rather than guess
- blurry screenshots, video stills, anything under the quality bar

Borderline? Drop it.

## Mechanics
Same as the other types: `photos.mjs --type dress` writes `photos/<slug>/NN.jpg` + `NN_thumb.jpg`
(~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`. The portrait-URL pre-filter
is OFF for this type (profile.portraitFilter=false), so the eyeball pass does the whole judging.
CSV `photos` column: `;`-separated workdir-relative paths. Never map the same file to two
entries; for multi-entry vendors the photos-map step attaches photos to the FIRST entry only.
