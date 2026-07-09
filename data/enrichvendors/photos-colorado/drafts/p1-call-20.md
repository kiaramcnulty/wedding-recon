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


=== PHOTOGRAPHER: Kayla Aug Photography | vendor_id=43b73564-3041-4d2d-a97f-d37384639ec3 | bot=bot14 | date=11/2025 ===
# Kayla Aug Photography (?) — vendor_id=43b73564-3041-4d2d-a97f-d37384639ec3
site=none | instagram=@kaylaaug.photography | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Kayla Aug Photography | also serves Alabama

=== PHOTOGRAPHER: Kiku Ishi Photography | vendor_id=05901e0f-2f74-492c-bdc2-7abeecfa9324 | bot=bot15 | date=6/2025 ===
# Kiku Ishi Photography (?) — vendor_id=05901e0f-2f74-492c-bdc2-7abeecfa9324
site=none | instagram=@kikuishiphoto | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Kiku Ishi Photography | kiku; also serves California

=== PHOTOGRAPHER: Lauren Leyba Photography | vendor_id=dc2982d5-f125-49e2-adf0-feb57799de4e | bot=bot16 | date=8/2025 ===
# Lauren Leyba Photography (Denver) — vendor_id=dc2982d5-f125-49e2-adf0-feb57799de4e
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Lauren Leyba Photography | Photojournalistic style; starts at $5,000; documentary approach capturing details and emotions

=== PHOTOGRAPHER: Lauren Vandame Photography | vendor_id=d1494c01-500f-4350-84a4-ec432c1a01d7 | bot=bot17 | date=4/2025 ===
# Lauren Vandame Photography (?) — vendor_id=d1494c01-500f-4350-84a4-ec432c1a01d7
site=none | instagram=@laurenvandame | google ?★ × ?

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: Ledia Tashi Photography | vendor_id=e1d8d28a-97a0-40ff-8450-200e8fcc4819 | bot=bot1 | date=12/2025 ===
# Ledia Tashi Photography (Denver) — vendor_id=e1d8d28a-97a0-40ff-8450-200e8fcc4819
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Ledia Tashi Photography | Minimum $10,000; film & digital, Super 8 film

=== PHOTOGRAPHER: M Nichole Photo | vendor_id=7c8d4335-ae80-4452-a513-7609063371f4 | bot=bot2 | date=8/2025 ===
# M Nichole Photo (?) — vendor_id=7c8d4335-ae80-4452-a513-7609063371f4
site=none | instagram=@mnicholephoto | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] M Nichole Photo | Marissa

=== PHOTOGRAPHER: Mackro Photography | vendor_id=03da80a4-5782-48d1-b2ee-05c01e2cfb2d | bot=bot3 | date=1/2025 ===
# Mackro Photography (?) — vendor_id=03da80a4-5782-48d1-b2ee-05c01e2cfb2d
site=none | instagram=@mackrophotography | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Mackro Photography | Mackenzie; wedding + elopement photographer

=== PHOTOGRAPHER: Makaila Rosin Photography | vendor_id=2cb77d99-c869-4ef9-8c28-2aef1a2bb113 | bot=bot4 | date=9/2025 ===
# Makaila Rosin Photography (?) — vendor_id=2cb77d99-c869-4ef9-8c28-2aef1a2bb113
site=none | instagram=@_mkrphotos | google ?★ × ?

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: Melanie Joy Photography | vendor_id=ccb89532-641e-4822-929a-26224759e87b | bot=bot5 | date=3/2025 ===
# Melanie Joy Photography (?) — vendor_id=ccb89532-641e-4822-929a-26224759e87b
site=none | instagram=@melaniejoy.photography | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Melanie Joy Photography | Melanie Joy

=== PHOTOGRAPHER: Melo Photo + Video | vendor_id=f119fb6d-6ad9-4d91-b0a0-1725d97de37a | bot=bot6 | date=9/2025 ===
# Melo Photo + Video (Denver) — vendor_id=f119fb6d-6ad9-4d91-b0a0-1725d97de37a
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Melo Photo + Video | Starting at $600 (per The Knot); services greater Denver area for wedding photo and video

=== PHOTOGRAPHER: Mike Kory Photography | vendor_id=959d60e3-4f8e-408f-a0c0-334a2e16c877 | bot=bot7 | date=4/2025 ===
# Mike Kory Photography (Boulder) — vendor_id=959d60e3-4f8e-408f-a0c0-334a2e16c877
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Mike Kory Photography | $2,800 starting per WPJA; mechanical engineer turned destination wedding photographer; documentary-style; associate photographer at Bonnie Photo; off-camera/dusk lighting for night shots; no independent website surfaced (works under Bonnie Photo)

=== PHOTOGRAPHER: Mrs. Ferree Photography | vendor_id=075ad2bf-f2ea-4974-a979-c0a232946aa5 | bot=bot8 | date=8/2025 ===
# Mrs. Ferree Photography (Denver) — vendor_id=075ad2bf-f2ea-4974-a979-c0a232946aa5
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Mrs. Ferree Photography | True to life digital & 35mm film photography; covers Estes Park, Aspen, Boulder

=== PHOTOGRAPHER: Natali Photographer | vendor_id=3c6ffc30-1614-425d-bf4e-040033ffcbf2 | bot=bot9 | date=11/2025 ===
# Natali Photographer (?) — vendor_id=3c6ffc30-1614-425d-bf4e-040033ffcbf2
site=none | instagram=@natali__photographer | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Natali Photographer | destination wedding photographer

=== PHOTOGRAPHER: Nicole Denae Photography | vendor_id=723f405a-f383-4346-a14f-a86e060477da | bot=bot10 | date=4/2026 ===
# Nicole Denae Photography (?) — vendor_id=723f405a-f383-4346-a14f-a86e060477da
site=none | instagram=@nicoledenaephoto | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Nicole Denae Photography | wedding and lifestyle photographer

=== PHOTOGRAPHER: Rachel McNurlen Photography | vendor_id=c3354407-7089-46af-b062-dcffc9f46b85 | bot=bot11 | date=6/2026 ===
# Rachel McNurlen Photography (Boulder/Denver) — vendor_id=c3354407-7089-46af-b062-dcffc9f46b85
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Rachel McNurlen Photography | Starting at $750 (per The Knot); serves Boulder, Denver, Rocky Mountains

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-20.csv
