# Type rules — venues (`entries` blocks label: VENUE)

## Wrong type? Two tiers (draft-contract has the full rule; write NO rows for either)
- `NOTAVENUE!:<slug>` (STRONG — positive evidence, auto-removed). Two ways to earn it:
  (a) a SERVICE vendor with no space of its own — a caterer, photographer,
  DJ/entertainment, florist, planner, officiant, stationery shop (site sells "our
  services"/"our packages" with no room/capacity/rental language, name like "X
  Catering"/"X Photography", reviews about food/photos/music rather than a space); or
  (b) a stay-only hotel or dine-in-only restaurant — pricing is ALL per-night-stay or
  per-plate, summary + reviews are about rooms/meals, and there is NO event-SPACE language
  (no ceremony/reception/ballroom/banquet hall, no rental or site fee, no guest-capacity
  count). A "room block for guests" is lodging, NOT event space — e.g. a boutique hotel +
  taproom whose site lists only room packages, amenity/parking fees, and a bar menu is a
  strong flag even though it mentions blocking rooms "for an event".
- `NOTAVENUE:<slug>` (SOFT — looks off but not certain). Draft the row(s) normally and add
  the flag; the orchestrator vets before removing.
- KEEP (never a flag): a caterer that ALSO rents its own hall is a venue. A hotel, resort,
  ranch, or golf club that merely LACKS wedding text — but shows nothing ruling events out
  — is `THIN`, not any wrong-type flag (Park Hyatt Beaver Creek, Keystone Ranch, Ski Tip
  Lodge host weddings even when their reviews are all about skiing).

## service_region
- Always null for venues — leave the `service_region` key OUT of the JSON entirely
  (upload sets null; the CSV has no such column for this type).

## What couples actually want captured
- Pricing packages (season/day-of-week/ceremony vs reception), capacity, what's included
  vs required, how the ownership/staff operates (responsive? family-run? corporate?),
  vibe, indoor/outdoor spaces, the three logistics below, and ANY firsthand commentary
  from reviews/reddit.

## Logistics couples specifically ask about (capture only when a source states it)
These three drive real go/no-go and budget calls, so surface them whenever the site,
reviews, or reddit actually address them. NEVER infer them from venue type — a remote
ranch does not automatically require a shuttle, a resort does not automatically offer
buyout lodging. If a source is silent on one, leave it out rather than guess; a hedged
"their site doesn't spell out the catering policy" is fine when it's genuinely unclear.
- **Catering policy** — which of the three models: in-house / exclusive caterer ONLY, an
  approved / preferred vendor LIST only, or open to any licensed outside caterer. Note
  food & beverage minimums and whether bar / alcohol must run through the venue.
- **Transport / shuttle** — is guest (or couple) shuttle transport REQUIRED (common where
  parking is tight or the site is remote), and if so does the venue PROVIDE it or must you
  arrange and pay for it yourself? Include any stated shuttle fee.
- **On-site lodging** — is there housing on the property, and for whom (the whole guest
  party, or just the couple / wedding party / immediate family)? Is a full-property BUYOUT
  or minimum-night stay REQUIRED to book, and at what cost?

## price_details specifics
- Packages, seasonal tables, minimums (beverage/food minimums count), deposits,
  per-person rates, site/venue fees.
