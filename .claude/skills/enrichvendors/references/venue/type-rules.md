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
  vs required (**catering policy especially**), how the ownership/staff operates
  (responsive? family-run? corporate?), vibe, indoor/outdoor spaces, and ANY firsthand
  commentary from reviews/reddit.

## price_details specifics
- Packages, seasonal tables, minimums (beverage/food minimums count), deposits,
  per-person rates, site/venue fees.
