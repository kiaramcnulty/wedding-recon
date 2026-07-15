# Type rules — caterers (`entries` blocks label: CATERER)

## Wrong type? Flag `NOTCATERER:<slug>` (write no rows)
- The dossier shows: a VENUE with in-house-only catering (capacity/rental/room language),
  a restaurant with no catering operation, a dessert/bakery-only shop, a bartending-only
  service, or a different vendor type entirely. A restaurant that demonstrably caters
  events IS a caterer — keep. A caterer that also rents its own hall belongs in venues,
  not here. When unsure, draft the row(s) and flag; the orchestrator decides.

## Wedding verification (Kiara, 2026-07)
- Look for evidence of WEDDING catering specifically: a weddings page on the site, a
  reddit mention, a Google review describing a wedding. Human recon counts even when the
  site never says "wedding". Minimum bar: clear large-event catering. If the dossier
  shows neither wedding nor large-event evidence, treat it like THIN — don't stretch a
  corporate-lunch caterer into a wedding entry.

## service_region — REQUIRED on every row
- WHERE they serve, sourced: site copy ("serving Denver and across Colorado"), base city
  + stated delivery radius. Narrowest sourced wins ("Denver metro", "Front Range");
  a storefront/kitchen address with no stated service area supports its city/metro
  ("Denver area"). Nothing narrower sourced → the run's state. Never invent; never blank
  (upload hard-fails).
- WHO they serve goes in `notes` when sourced: microweddings only, guest-count minimums,
  full-service vs drop-off.

## What couples actually want captured
- Catering type: food truck, buffet, plated courses, stations, family-style, drop-off.
- Wedding menu specifics when published: actual food items, themes/genres of cuisine,
  signature dishes.
- Quality/opinions from reviews and reddit, attributed: how the food actually was, staff
  and service color, tasting experience.
- Logistics that surface: staffing/bartending included or extra, rentals (plates/linens),
  vendor-meal policies.

## price_details specifics
- Per-person/per-plate rates, package tiers, guest minimums, service charges/staffing
  fees, deposits, tasting policy (free vs paid), bar packages. "Personalized consultation
  only" is a valid honest answer when that's all the sources say — and one couple's real
  spend from a review or reddit is a great sourced data point ("a couple on reddit paid
  about $X for Y guests").
