# Type card: hotel blocks (`--type hotelblocks`)

Profile key `hotel` → `vendor_type='hotel'` (app category: Hotel icon, navy; label "Hotel blocks", plural copy "hotels"), working CSV `vendors.csv`. Does NOT capture instagram. Accepts aliases `hotel(s)`/`hotelblock(s)`/`hotel-block(s)`/`block(s)`/`lodging`/`accommodation(s)`/`rooms`.

**Preflight:** migration `supabase/migrations/0023_add_hotel_vendor_type.sql` (the `hotel` enum value) must be hand-applied (Supabase SQL editor) before Phase 5 — without it Postgres rejects the insert outright. Confirm with the user in Phase 0. No `0016` needed (this type doesn't capture instagram).

## Ground truth

### THE bar: no documented block, no row (Kiara, 2026-07)
**Only include a hotel when you can point to an actual record of a wedding room block / bulk-booking option.** Marketing fluff ("perfect for your special day") is not evidence. Acceptable evidence, in rough order of strength:
- the hotel's own **weddings / groups / meetings page** describing room blocks, group rates, or a group-sales contact;
- a **Google review or Reddit comment from someone who actually booked or stayed in a block** there;
- a listing on a block-brokering site (**HotelPlanner**, **Engine**, Zola/The Knot hotel-block listings) showing that property takes wedding blocks.

If you can't find any of that, **leave it out** — a hotel that merely exists near a venue is not a vendor for this directory. This inverts the usual tie-break: for this type, **ties go to REMOVE**, including for research-sourced rows.

**A block with no discount still counts.** Plenty of hotels hold a block purely as an availability guarantee at (or near) the going rate. That's a legitimate, useful listing — capture it and say so in `intel`. The bar is "a block exists," not "a deal exists."

### Venue supersedes hotel — the overlap rule
A property with **wedding event space** (ballroom, ceremony lawn, reception hall, banquet rooms) is a **`venue`**, not a `hotel`, even when it also blocks guest rooms. `hotel` is for **stay-only** properties whose wedding-relevant offering IS the room block. Two consequences:
- Enforced mechanically at upload: `google_place_id` dedup is **global across vendor types**, so a property already seeded as a `venue` is skipped with `already in DB as venue`. **Expect a meaningful count of these on any region that had a venue launch first — that's the rule working, not an error.** Report the count and names; never try to work around it.
- Enforced by judgment in Phase 4 for properties NOT yet in the DB: a hotel that markets wedding ceremonies/receptions on site → remove from this run and note it as a venue candidate. The name can't tell you ("Hilton Denver" reads the same either way) — the site can.
- The converse is a gift: venue enrichment auto-removes **stay-only hotels** via `NOTAVENUE!` (all per-night pricing, reviews about rooms, zero event-space language). Those removed properties are this type's **prime candidates** — if a venue run in this region logged any, mine that list first.

### Other ground truth
- **Strong Places sweep, unlike the service types.** Hotels are real addressed businesses, so expect a high match rate and a LOW centroid/no-match count. The hard part here is never "finding hotels" — it's proving a block exists.
- **Block terms are almost never on a homepage** — they live on a `/weddings`, `/groups`, or `/meetings` subpage. `wedcheck` handles this directly for this type: it **follows the hotel's own same-host links** (≤3, matched on href or nav label) before giving up, so a property that documents its block anywhere on its site is kept and counted as `by subpage` in the summary. `pruned.csv` is the backstop for the rest, not the primary path.
- **Chains vs. independents:** both are in scope. Chain properties (Hampton, Courtyard, Hyatt Place) are the workhorses of guest blocks; boutique/independent hotels often have the more interesting terms.
- **Excluded (can't hold a block):** hostels, RV parks/campgrounds, vacation-rental and short-term-rental agencies, realty/property management, timeshares, extended-stay corporate housing, travel agencies. Most are pruned by name at sweep time.

## Phase 1 — sweep
ONE query per anchor: `wedding hotel blocks near {anchor}` (Kiara's keyword). Statewide launches add `wedding hotel blocks in {StateName}`. Both encoded in `TYPE_PROFILES.hotel`.

Then the **intent check** (mandatory, but read its output differently for this type):
```
node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs data/launchvendors/<slug> --type hotelblocks
```
The regex is a cheap prefilter (`wedding|bridal|room block|group rate/block/booking/sales`), NOT the evidence bar — it keeps anything wedding- or group-shaped and prunes the generic roadside motel. For this type wedcheck also **follows the hotel's own `/weddings`, `/groups`, `/meetings` links** (`intentSubpage`, ≤3 pages, same host only), which is where block language actually lives; those keeps show up as `by subpage` in the summary. Still relay the pruned names and treat `pruned.csv` as a backstop worklist — a hotel whose site says nothing but that HotelPlanner or a reddit thread evidences comes back through Phase 2 research (or `--rescue` in Phase 4).

## Phase 2 — web research queries (4–6 WebSearches)
Research carries more weight for this type than for any other, because the evidence bar lives here.
- `{region} wedding hotel block` / `{region} wedding room block guests`
- `hotelplanner {region} wedding` / `{region} wedding hotel blocks hotelplanner`
- `engine {region} hotel group booking wedding` (Engine, formerly Hotel Engine)
- `{region} wedding guest hotel recommendations reddit`
- `{region} wedding hotel block courtesy vs guaranteed reddit`
- `best hotels for wedding guests {region}`

**Block-brokering sites are the highest-yield sources** (Kiara, 2026-07): **HotelPlanner** and **Engine** exist to broker exactly this, and their city pages enumerate properties that take wedding blocks — which is itself the evidence the bar asks for. Zola and The Knot also publish hotel-block listings per city. Fetch these before generic "best hotels" listicles.

Fetch-extraction prompt (substitute region/state/domain):

> List every HOTEL on this page that offers, or is listed as offering, a WEDDING ROOM BLOCK / group booking for wedding guests serving {REGION}, {ST}. Output ONLY JSON lines, one per hotel: {"name":"...","hint":"<their city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","provenance":"web:{domain}","intel":"<the EVIDENCE that they take wedding blocks (quote or paraphrase the page), the block TYPE if stated (courtesy block vs. guaranteed/attrition block), any minimum room count or contract minimum, whether the couple prepays and is reimbursed or guests book and pay directly, any cut-off date, the approximate nightly ROOM RATE, how the block rate compares to the normal/rack rate (a real discount vs. just an availability guarantee vs. no discount at all — all three are worth recording), amenities named (parking and whether it's free, shuttle to venues, breakfast, resort fee), distance to popular wedding venues, and region served, else omit>"}. EXCLUDE hostels, RV parks, vacation-rental or short-term-rental agencies, realty/property management, timeshares, and travel agencies. ALSO EXCLUDE hotels presented mainly as a wedding VENUE with ballroom/ceremony/reception space — those are a different category — unless the page is specifically about their guest room blocks. If a hotel is named with no indication it takes blocks, do NOT list it. No commentary, no markdown.

### Website hunt (same subagent, after extraction)
For each candidate **missing a website**, run one WebSearch: `"{full name}" {city} {ST} hotel` — take the property's OWN domain (never a directory/booking-aggregator link as `website`). Chain properties often only have a deep brand URL; that's fine as their site. Cap ~20 hunt searches per agent run.

## Phase 2 — Reddit-paste extraction prompt

Reddit matters more here than anywhere else: **block terms are rarely published, but couples discuss them constantly.** Push for pastes.

> Read every `reddit-*.txt` file in `<abs workdir>/research/`. They are raw pastes of threads about WEDDING GUEST HOTELS and HOTEL ROOM BLOCKS near {REGION}, {ST}. Extract every distinct hotel that a commenter blocked rooms at, stayed in as a wedding guest, or recommends for a block. Append one JSON line per hotel to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<city if stated, else omit>","website":"<their own website if linked, else omit>","provenance":"reddit:<filename>","intel":"<the firsthand block details — was it a COURTESY block (no obligation, rooms released back) or a GUARANTEED/ATTRITION block (the couple owes for unbooked rooms), how many rooms minimum, whether the couple had to PREPAY and get reimbursed or guests paid directly, the NIGHTLY RATE they got and what the hotel's normal rate was (was it actually discounted, barely discounted, or not at all), the cut-off date, whether the block filled or rooms went unused, contract or minimum-spend surprises, parking cost, shuttle arrangements, and any warning, else omit>"}. Do NOT list a hotel that is only mentioned in passing with no block or stay detail. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

## Phase 4 — adjudication watchlist (your call, not Kiara's)
This type's docket is judged against the evidence bar, so it is stricter than the others:
- **No block evidence found anywhere** (sweep row, nothing in research, nothing in reviews) → **remove**. This is the type's whole premise; do not ship a hotel on vibes. Ties go to remove.
- **Wedding VENUES with rooms** (property markets ballrooms/ceremonies) → remove from this run; note them as venue candidates for a `--type venue` run.
- **Rescue from `pruned.csv`** any hotel that wedcheck pruned but research later evidenced — this is expected and common for this type, not an exception.
- **Non-block lodging** that dodged the junk filter (hostels, extended-stay corporate housing, rental agencies) → remove.
- Chain-name dedup collisions — the profile treats "Hampton Inn Denver" ≡ "Hampton Inn & Suites Denver". Two genuinely different properties of the same brand in the same city is the one case to check on the dry-run's name+city skip list; if they're distinct hotels, the city is usually distinct too.

## Enrichment handoff (recon guidelines)
Archive into `intel` now; the enrichment pass consumes it:
- **The block evidence itself** — carry over what proved it, so enrichment doesn't re-derive it.
- **Block type — the single most useful fact.** *Courtesy* block (rooms held, released back unbooked, couple owes nothing) vs. *guaranteed / attrition* block (couple is contractually on the hook for a percentage of unbooked rooms). Couples get burned by the difference.
- **Contract shape:** minimum room count, minimum number of nights, cut-off date, whether the couple **prepays and is reimbursed** or **guests book and pay directly** (the latter is what most couples want), any signed-contract or minimum-spend requirement.
- **Rate reality:** approximate nightly rate, and how it compares to the property's normal rate — genuinely discounted, barely discounted, or purely an availability guarantee at rack rate. **Record "no discount" plainly; it's a legitimate finding, not a disqualifier.**
- **Amenities:** parking and whether it's free, shuttle/transport to venues, breakfast, resort/facility fees, suites for getting ready, proximity to popular venues.
- **Firsthand anecdotes** — did the block fill, did guests struggle to book it, did the hotel honor the rate, was the group-sales contact responsive.
- **Photos:** 1–2 guest-room / property shots (see enrich `references/hotelblocks/photo-rules.md`).
