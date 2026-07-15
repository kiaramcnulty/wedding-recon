# Type rules — venues (`entries` blocks label: VENUE)

## Wrong type? Flag `NOTAVENUE:<slug>` (write no rows)
- The dossier shows a SERVICE vendor, not a place that hosts weddings — a caterer,
  photographer, DJ/entertainment, florist, planner, officiant, stationery shop — with no
  event space of its own. (Signals: site sells "our services"/"our packages" with no
  room/capacity/rental language, name like "X Catering"/"X Photography", reviews about
  food/photos/music rather than a space.) A caterer that ALSO rents its own hall is a
  venue — keep it. When unsure, draft the row(s) and flag; the orchestrator decides.

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
