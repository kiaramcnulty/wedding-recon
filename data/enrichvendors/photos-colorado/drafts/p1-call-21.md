# Draft call — /enrichvendors, type=photographer (single-turn contract)

You are drafting bot recon entries for the WEDDING PHOTOGRAPHERS listed below. Everything you need is IN THIS FILE: the rules, the bot voices, and one research dossier per photographer. Do NOT read any other file, do NOT search the web, do NOT use any tool except one Write at the end. Never fabricate a price, quote, event, or booking.

## Output contract
- EXACTLY ONE CSV row per photographer, authored by that photographer's assigned `bot`, dated with its assigned `date` (override the date only if the dossier contains a clearly better-sourced real date, e.g. a dated reddit comment).
- `recon_type` is always `online`.
- `price_text` + `price_details` REQUIRED on every row. Dossier has real figures → an honest, hedged range tied to them (packages/hours/what's-included in `price_details`: tiers, add-ons like video, engagement session, second shooter, albums, extra hours or speeches coverage; mention travel-cost inclusion ONLY if a source states it — otherwise stay silent on travel). No figures → `price_text` = `Quote only` and `price_details` honestly says what you checked and that pricing is on inquiry. NEVER invent a number.
- `service_region` REQUIRED on every row: where they shoot, from dossier clues (site copy like "serving the Front Range", a name like "X Colorado Weddings", an instagram bio, a base town plus "travels"). Sourced-narrow beats vague: "Denver metro", "Western Slope", "Colorado + destination". Nothing narrower sourced → `Colorado`. Never invent a narrow region.
- `notes`: ONE line (no embedded newlines), first person, in the assigned bot's voice per the voice cards. **2-5 sentences. Rich dossier → up to ~90 words. Thin or quote-only photographer → 25-50 words and stop; don't pad.** Keep concrete facts: package shape, hours, photo vs photo+video, coverage types (wedding/elopement/engagement), style words THEY use (documentary, light and airy, editorial), specialties (mountain/outdoor, micro-weddings), turnaround, a review specific, responsiveness. Attribute borrowed experiences ("a bride on reddit said...", "a review mentions..."); never first person for things the bot didn't do. Include warts when sources have them.
- No em/en dashes (– —) anywhere; use hyphens, commas, periods. No banned marketing/AI phrases (list in the entry rules below). Vary sentence openings and shapes across rows — no two rows share a long word-run.
- NEVER use research-tooling language: no "crawl", "scrape", "fetch", "parse", "harvest", "dossier", "boilerplate", "garbled text", or descriptions of pages failing to be machine-read. Describe gaps the way a person would: "their site doesn't list pricing", "you have to inquire for rates", "couldn't get their pricing page to load".
- NEVER reference this project or how the entry was produced: no "batch", "enrich", "seeded", "roster", "dataset", "bot", "pipeline", or any hint that the photographer is one of a set being processed. The note is one couple writing about one photographer — it must read as if nothing else exists.
- `photos`: EMPTY. `sources`: short refs only, e.g. `site /investment; google reviews; reddit:reddit-04.txt` — no commas inside.
- If a dossier is unusually rich (real pricing AND strong firsthand commentary), still write ONE row, but append ` RICH:<slug>` to that row's line in your reply so a second entry can be commissioned separately.
- If a dossier shows the vendor is NOT a wedding photographer — a venue with its own event space, a photo-booth rental, a video-only outfit, a portrait/boudoir studio with no wedding work — do NOT write a row; append ` NOTPHOTOG:<slug>` to your reply instead. A photographer who ALSO offers video is a photographer — keep them.
- If a dossier has essentially NOTHING beyond name/city (no site text, no reviews, no digest or reddit lines, no google summary), do NOT pad a row out of air: append ` THIN:<slug>` to your reply and skip it. An entry must contain at least one real sourced fact.

## CSV format (exact)
Header once: `venue,vendor_id,recon_type,month,year,price_text,price_details,notes,photos,sources,bot,service_region`
(The first column is named `venue` for historical reasons — put the PHOTOGRAPHER'S business name there.) Copy `vendor_id` and `bot` VERBATIM from each photographer block. Wrap any field containing a comma or quote in double quotes; double internal quotes; never a raw newline inside a field.

## Finish
Write the complete CSV (header + all rows) to the OUTPUT FILE named at the bottom of this file, in ONE Write call. Then STOP and reply with exactly one line: `<output file>: done` (plus ` RICH: slug1, slug2` / ` NOTPHOTOG: slug1` / ` THIN: slug1, slug2` if any).

Do NOT read your CSV back to check or count it, do NOT re-read this file, do NOT list directories or reach for any other tool. Downstream scripts validate every row for free (coverage, pricing fields, service_region, banned phrases, em-dashes, dedup) — a read-back only re-bills this whole file's tokens for nothing, and a wrong cell is cheaper to fix later than a re-read is now. Write once and stop.


---

# Entry synthesis rules — photographers (all mandatory)

## Not a wedding photographer? Flag it (do NOT draft a row)
- `NOTPHOTOG:<slug>` when the dossier shows: a VENUE with its own event space, a photo-booth
  rental, a video-only production company, or a portrait/family/boudoir studio with no
  wedding work. (Signals: capacity/rental/room language, "book our booth", site is all
  newborn/headshot galleries.) A photographer who also sells video, films, or Super 8
  add-ons IS a wedding photographer — keep. When unsure, draft the row and flag it;
  the orchestrator decides.
- `THIN:<slug>` when there is nothing real to say: no site text, no reviews, no digest,
  no reddit, no google summary — just a name. Kiara's rule: fewer or zero entries beats
  invented content. An entry must carry at least one sourced fact.

## How many entries
- **Exactly ONE row per photographer listed in your call file**, by the assigned bot.
  Unusually rich dossier (real pricing AND strong firsthand commentary) → still one row,
  flag ` RICH:<slug>` for a separately-commissioned second entry (different bot,
  review/experience cluster — same split rules as venues).

## service_region — REQUIRED on every row (photographers only)
- Where they shoot, sourced from the dossier: site copy ("serving Denver and the Front
  Range"), name clues ("Danielle Hart Colorado Weddings" → Colorado), instagram bio
  ("Colorado + destination"), base town + stated travel.
- Prefer the narrowest SOURCED region: "Denver metro", "Front Range", "Western Slope",
  "Summit County + destination". Nothing narrower sourced → `Colorado`. If they clearly
  travel ("destination", "worldwide", "will travel"), append " + destination".
- Never invent a narrow region; never leave blank (upload hard-fails).

## price_text + price_details — REQUIRED on every entry
- `price_text`: compact headline, e.g. "$3,500-$5,500 packages", "starts around $4k for
  8 hours", "Quote only".
- `price_details`: package tiers and hours, add-ons (video, engagement session, second
  shooter, albums, extra hours, coverage through speeches), deposits/retainers, elopement
  vs full-wedding pricing. Travel costs ONLY if a source states whether they're included —
  if unclear, don't mention travel at all.
- No published pricing (common — many say "inquire"): `price_text` = `Quote only`,
  `price_details` says what you checked and that pricing is on inquiry; then let `notes`
  lead with style/services/specialties instead. NEVER invent numbers, NEVER extrapolate
  a market rate onto a specific photographer.

## Notes content (what couples actually want here)
- Photo vs photo+video; wedding/elopement/engagement coverage; the style words THEY use
  (documentary, candid, light and airy, editorial, moody); specialties (outdoor/mountain
  landscapes, micro-weddings, adventure elopements); hours/second-shooter shape;
  turnaround time; responsiveness; how booking works (call required vs prices up front);
  any firsthand review/reddit color, attributed.
- 2-5 sentences, ONE line. Rich → up to ~90 words; thin → 25-50 and stop. Every sentence
  earns its place with a concrete fact. Include negatives when sourced (slow replies,
  zoomed-out shots, travel fees stacking up).

## Dates, recon_type, truth — same as venues
- Use the pre-assigned `date=M/YYYY`; a real source date wins (dated reddit comment).
- `recon_type` = `online` for all rows. `in_person`/`virtual` implies a fabricated
  meeting — never without explicit per-entry user sign-off.
- Every fact traces to a named source (`sources` column). Borrowed experiences are
  attributed in-text. Warts make entries credible.

## Other fields
- `venue` column = the photographer's business name (historical column name).
- `vendor_id`: copy VERBATIM from your call file's block. Never guess.
- `bot`: `botN` keys from the roster; a bot never gets two entries for the same vendor;
  ≤50/bot/run. Bots are PER STATE and shared across vendor types — the same account may
  already have venue entries; that's expected (a real couple researches venues AND
  photographers).


---

# Bot voice cards

Every bot keeps ONE register across all its entries. Before writing, also read 2-3 real
user entries (`recon_entries` where author is not a bot) and any `research/reddit-*.txt`
for the region — match that energy, not these cards' letter.

**Banned everywhere** (upload.mjs rejects them): stunning, breathtaking, nestled, boasts,
elevate(s/d), unforgettable, magical, "dream wedding", exquisite, picturesque, "genuine
value", "can't go wrong", "won't disappoint", "truly special". **Em dashes and en dashes
are banned outright** (validator rejects them): real users type hyphens, commas, periods.

**Every judgment must be concrete.** "A genuine value" means nothing; "$4k for 9 hours in
a mansion that seats 180" means something. If you can't tie a verdict to a number, a
policy, or a sourced quote, cut the verdict and keep the fact. Also avoid: tricolons
("X, Y, and Z" flourishes), identical sentence structure across entries, opening every
note the same way, and "the tradeoff/the thing to know" framing more than once per batch.

## bot1 — lowercase + dash bullets (closest to real early users)
All lowercase. Notes are `-` bullets of practical fragments. Uses "w/", "~", "&".

Golden (Manor House):
> price_text: $4k-$15k venue + food $68-105pp
> notes: -1914 mansion in the foothills above littleton w/ real mountain views
> -capacity ~200
> -they do a group tasting night w/ all the couples marrying that year, sounds fun honestly
> -teddy roosevelt apparently visited, his photos are all over the walls

Golden (Mile High Station, commentary entry — note the hedged required price):
> price_text: ~$2.5k-$7.3k venue for peak months
> price_details: didn't request a quote - published peak (may-oct + december) rates run $2,500-$7,300 before the $3,500+ beverage minimum kicks in. off-peak dips to ~$1,500
> notes: review digging: photographers love shooting here (space + industrial light). the main flag i found was a 3 star from a guest at a big private event - no last call announcement, the bar shut 40 min early & staff started boxing up food while people were still dancing.

## bot2 — sentence-case prose, no bullets
Proper capitalization, complete sentences, flowing paragraphs. Reads like a thoughtful comment.

Golden (Moss Denver):
> price_text: Around $6,500 for a spring Saturday, cheaper midweek
> notes: Went down a review rabbit hole on this one. A couple who got married there last year said their main goal was basically a great dance party that was easy for out-of-town guests, and Moss delivered. A wedding planner reviewed them too and specifically called out how fast they answer emails.

## bot3 — punchy caps-label bullets, occasional CAPS emphasis
Short fragments. `- Label: value` bullets. Emphasis in CAPS sparingly.

Golden (Dunafon Castle):
> notes: Review roundup:
> - Photographer: 'not one bad view on the property.' Grounds = immaculate
> - One bridesmaid knocked them HARD for bad lighting in the brides room. Asked for an extra lamp, got laughed at. Plan getting-ready photos elsewhere
> - Tip from a review: the Lair O' The Bear trail runs along the perimeter if you want a free peek before booking a tour

## bot4 — run-on casual, parenthetical asides, light slang
No bullets. lol / tbh / imo sparingly. Thoughts strung together like a reddit reply.

Golden (Manor House, reddit-sourced):
> price_text: $11k venue for a sunday, saturdays run $12k+ more
> notes: found a whole reddit thread on this place and it was super useful. a bride who got married there called it stress free, said they were great communicators and even learned a new cocktail for her (also that they cook steak surprisingly well lol). only knock: two separate people mentioned a funky smell on their tour?? so sniff around i guess. sunday/weekday is clearly the move here

## Adding bots beyond bot4
New personas must be distinct from the four above (e.g. terse one-liner minimalist;
numbered-list planner type; typo-prone enthusiastic). Usernames: reddit-plausible, NOT
wedding-punny, skew female (precedent: denverliz, megatron22, coloradogirl303, hikerbynight).
The user approves every new username before account creation.


=== PHOTOGRAPHER: Samantha Ruscher Photography | vendor_id=66ff7828-0edd-4116-b8c4-aa5362f89d58 | bot=bot12 | date=5/2026 ===
# Samantha Ruscher Photography (?) — vendor_id=66ff7828-0edd-4116-b8c4-aa5362f89d58
site=none | instagram=@samantha.ruscher.photo | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Samantha Ruscher Photography | also does Super8 films

=== PHOTOGRAPHER: Sarah Arnold Photography | vendor_id=3a46c589-020c-41ff-b447-912a6a5fb8d1 | bot=bot13 | date=4/2026 ===
# Sarah Arnold Photography (Colorado Springs) — vendor_id=3a46c589-020c-41ff-b447-912a6a5fb8d1
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Sarah Arnold Photography | Serving couples throughout Colorado and destinations nationwide; documenting weddings since 2013

=== PHOTOGRAPHER: Savannah Lauren Photography | vendor_id=75119ca5-f998-48ad-9726-73c2328d0d71 | bot=bot14 | date=5/2025 ===
# Savannah Lauren Photography (?) — vendor_id=75119ca5-f998-48ad-9726-73c2328d0d71
site=none | instagram=@savannahlaurenphotography | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Savannah Lauren Photography | also destination

=== PHOTOGRAPHER: Sharee Davenport Photography | vendor_id=c62e5d80-4b8f-4dad-bc95-6ddd53a91eef | bot=bot15 | date=6/2025 ===
# Sharee Davenport Photography (?) — vendor_id=c62e5d80-4b8f-4dad-bc95-6ddd53a91eef
site=none | instagram=@shareedavenport | google ?★ × ?

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: Stephanie Mathena Photography | vendor_id=af30e3e2-2575-44a7-8952-9323074cca2d | bot=bot16 | date=9/2025 ===
# Stephanie Mathena Photography (Denver) — vendor_id=af30e3e2-2575-44a7-8952-9323074cca2d
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Stephanie Mathena Photography | Classic style; starts at $338 (affordable rate); focuses on scenery and color blocking

=== PHOTOGRAPHER: Taryn Ashlee Photography | vendor_id=54e89808-eb21-44e0-b3ff-77192ef17b8f | bot=bot17 | date=4/2025 ===
# Taryn Ashlee Photography (?) — vendor_id=54e89808-eb21-44e0-b3ff-77192ef17b8f
site=none | instagram=@tarynashleephotography | google ?★ × ?

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: The Pic Chick | vendor_id=1693ba72-1365-4455-9874-831c1ce12e14 | bot=bot1 | date=3/2026 ===
# The Pic Chick (Thornton) — vendor_id=1693ba72-1365-4455-9874-831c1ce12e14
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] The Pic Chick | Classic style; starts at $2,700; 18+ years experience; pressure-free approach

=== PHOTOGRAPHER: The Twilight Photo & Film | vendor_id=96b9e20b-a7ec-4e63-a70d-359147bbfddf | bot=bot2 | date=6/2026 ===
# The Twilight Photo & Film (Colorado Springs) — vendor_id=96b9e20b-a7ec-4e63-a70d-359147bbfddf
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] The Twilight Photo & Film | Editorial style; starts at $1,995; photography and videography, cinematic storytelling

=== PHOTOGRAPHER: The Wild Phern | vendor_id=c19c0198-4fae-437d-af79-d7643bbd1338 | bot=bot3 | date=6/2025 ===
# The Wild Phern (?) — vendor_id=c19c0198-4fae-437d-af79-d7643bbd1338
site=none | instagram=@thewildphern | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] The Wild Phern | relocating to Colorado, vibrant style, running a special for Colorado couples

=== PHOTOGRAPHER: Tilted Frame Photography & Design | vendor_id=9061908e-c689-44a1-8ea0-be4c1160c4c9 | bot=bot4 | date=1/2026 ===
# Tilted Frame Photography & Design (Denver) — vendor_id=9061908e-c689-44a1-8ea0-be4c1160c4c9
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Tilted Frame Photography & Design | Fine art style; starts at $2,200; storytelling and genuine moments; wedding and elopement

=== PHOTOGRAPHER: Valr Studios Photography | vendor_id=45973bd7-1876-48b1-aaf2-f7ef44f5a180 | bot=bot5 | date=7/2025 ===
# Valr Studios Photography (Colorado Springs) — vendor_id=45973bd7-1876-48b1-aaf2-f7ef44f5a180
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Valr Studios Photography | Photojournalistic style; starts at $3,000; focus on connection and emotional pacing

=== PHOTOGRAPHER: Whitney Rae Photography | vendor_id=e127dd2a-aacf-4b38-b38e-f49fb4898975 | bot=bot6 | date=1/2026 ===
# Whitney Rae Photography (Vail) — vendor_id=e127dd2a-aacf-4b38-b38e-f49fb4898975
site=none | instagram=@whitneyraephotography | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Whitney Rae Photography | also serves destination weddings

=== PHOTOGRAPHER: Yoni Gill Photography | vendor_id=17100e9b-dfa7-4758-9d75-e2d533f58969 | bot=bot7 | date=1/2026 ===
# Yoni Gill Photography (?) — vendor_id=17100e9b-dfa7-4758-9d75-e2d533f58969
site=none | instagram=@yonigill | google ?★ × ?

## site pricing/package lines
(none found on site)

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-21.csv
