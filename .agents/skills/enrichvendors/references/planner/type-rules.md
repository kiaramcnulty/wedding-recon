# Type rules — wedding planners (`entries` blocks label: PLANNER)

## Lean HEAVILY on reviews + reddit (Kiara, 2026-07) — this is the whole game for planners
A planner's own site is usually THIN: a packages list, a services list, a portfolio, and
little else. The useful intel lives in **firsthand accounts** — Google reviews and reddit.
Weight them accordingly and attribute them ("a bride on reddit said...", "a review
mentions..."):
- What actually went well vs badly on the day; what they were GREAT at; where they were
  weak (slow email replies, pushed their own vendor list, disappeared day-of).
- Where the planner spent their time and effort (design vs logistics vs vendor wrangling vs
  timeline/day-of run-of-show), and how hands-on they were.
- Whether the couple felt calm/taken-care-of, whether the timeline held, how they handled
  problems when something went wrong.
- Concrete specifics beat adjectives: "she built the whole run-of-show and chased every
  vendor the week before" says more than "amazing and professional".
An entry with real anecdotal color and no published price is a GOOD entry. If the dossier
has only a bare services list and no review/reddit substance, that's `THIN`, not a stretch.

## Services + packages — capture the specific tiers offered
Planners sell distinct service LEVELS; name the ones the sources actually show:
- **Full planning** (start-to-finish, ~12+ months, design + vendor selection + logistics),
- **Partial planning** (join partway, fill gaps),
- **Day-of / month-of coordination** (couple plans, planner runs the day + final weeks),
- **À la carte / hourly**, design-only, or "wedding guiding"/elopement-guide style help.
Say which levels THIS planner offers and, where sourced, what each includes.

## Wedding styles + specialties (capture when sourced)
The style/niche a planner leans into is high-value for couples: **mountain weddings, beach
weddings, destination weddings, microweddings/elopements, luxury/large-format, cultural or
multi-day celebrations, budget-conscious**. Pull these from site copy, portfolio captions,
or review/reddit language and put them in `notes` — never invent a specialty.

## service_region + travel fees — REQUIRED on every row
- WHERE they plan, sourced: site copy ("serving Denver and the mountain towns"), base city
  + stated travel radius, name clues. Narrowest SOURCED region wins ("Denver metro", "Summit
  County + mountains"). **If no service area is stated anywhere, default to the run's state**
  (e.g. `Colorado`) — planners travel to the couple's venue, so statewide is the safe floor.
  If they clearly go further ("destination", "will travel", "worldwide"), append
  " + destination". Never blank (upload hard-fails); never invent a narrow region.
- **Travel fees:** planners commonly charge for mountain/destination travel — capture it
  when a source states it (flat fee, mileage, lodging for multi-day). Put the fact in
  `price_details`/`notes`; if travel cost is unstated, don't mention it (don't assume).

## Wrong type? Two tiers (draft-contract has the full rule; write NO rows for either)
- `NOTPLANNER!:<slug>` (STRONG — positive evidence, auto-removed) — the dossier positively
  shows a DIFFERENT kind of business: a VENUE with its own event space (capacity/rental/room
  language), a photographer/florist/caterer/DJ whose site sells that other service, a rental
  company, or a **financial/estate/party planner with no wedding work**. Its name and site
  sell the other thing.
- `NOTPLANNER:<slug>` (SOFT — looks off but not certain) — draft the row(s) normally and
  flag; the orchestrator vets before removing.
- KEEP (never a flag): a planner who ALSO offers design, florals, or rentals as add-ons is
  still a planner. A planner who runs their OWN venue belongs in venues — re-type, don't
  flag. A coordinator who only does day-of IS a planner (day-of coordination is the service).

## price_details specifics
- The package tiers above with any sourced numbers: full-planning starting price, partial,
  day-of/month-of coordination rate, hourly, flat fees. **Percentage-of-budget** pricing is a
  real planner model (often ~10-15% of total spend) — capture it verbatim when stated.
- Deposits/retainers, what a package includes (number of meetings, vendor referrals,
  design/mood-boards, rehearsal + day-of hours, assistant coverage).
- Very often "quote/consultation only" — that's the honest answer when the site lists
  packages by name but no prices. One couple's real spend from a review or reddit
  ("we paid about $3k for month-of coordination") is a great sourced data point.
