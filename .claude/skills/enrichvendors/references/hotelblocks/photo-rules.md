# Photo rules — hotels (guest room blocks)

Sourcing: the hotel's OWN website only (photos.mjs enforces this by construction — it only
downloads URLs harvested from their site). NEVER re-host booking-aggregator images
(Booking.com, Expedia, HotelPlanner, Engine), The Knot / Zola gallery images, or Google
Places photos (ToS forbids caching). Keep `manifest.json` source_url for every file.

Target: **1-2 photos.** Photos are the least important part of this type — the block terms
are the product — so ship photo-less rather than pad. Coming in under target is always
better than including a non-qualifying image.

## The mandatory eyeball pass
A script cannot judge content. Before mapping any photo into the CSV, view its `_thumb.jpg`
and decide. What a couple wants to see is **where their guests will actually sleep**, so the
subject is the room and the property. `portraitFilter` is ON for this type (people-as-subject
is junk here, same as venues and caterers), so obvious couple-portrait URLs are pre-dropped
and your pass handles the rest.

KEEP only if it shows the guest-lodging product:
- a guest room or suite interior — the core shot
- the property exterior or entrance (helps a guest recognize it)
- the lobby, or a genuinely useful amenity a guest uses: pool, fitness room, breakfast area,
  on-site bar/restaurant, parking structure
- a real info card: a posted group-rate or amenity sheet

ALWAYS DROP:
- logos, wordmarks, brand badges, award graphics, "featured on" banners, title cards
- **ballroom / banquet / ceremony / reception-setup shots** — that's event space, and event
  space is the VENUE category's product, not this one. Including it miscategorizes the
  property in a reader's mind; when a room shot is ambiguous between "guest suite" and
  "event room", drop it
- couples, wedding parties, ceremonies, receptions — people-as-subject is a photographer's
  shot, not lodging
- staff portraits, generic stock photography, city skyline or landmark shots that aren't
  the property
- other vendors' work embedded in a blog post
- blurry screenshots, video stills, floor-plan diagrams, anything under the quality bar

Borderline? Drop it.

## Mechanics
Same as the other types: `photos.mjs --type hotelblocks` writes `photos/<slug>/NN.jpg` +
`NN_thumb.jpg` (~1600px/~400px JPEG) + `manifest.json` with per-photo `source_url`. The
portrait-URL pre-filter is ON for this type (profile.portraitFilter=true). CSV `photos`
column: `;`-separated workdir-relative paths. Never map the same file to two entries; for
multi-entry vendors the photos-map step attaches photos to the FIRST entry only.
