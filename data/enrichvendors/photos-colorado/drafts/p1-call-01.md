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


=== PHOTOGRAPHER: Alex Benavidez | vendor_id=ca73a27f-dfa9-4bb0-9dec-e46b8b8bb23b | bot=bot1 | date=9/2025 ===
# Alex Benavidez (?) — vendor_id=ca73a27f-dfa9-4bb0-9dec-e46b8b8bb23b
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Alex Benavidez | candid and documentary style

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"

Colorado Wedding Photographers — Quick Crowd Recommendations

Popular Styles & What Redditors Recommend
Documentary / Candid: Many users suggested documentary-style options like Alex Benavidez. "Alex Benavidez has a candid and documentary style"
Cinematic / Moody: For cinematic or moody looks people named local specialists and studios. "https://kellymillerstudios.com ... https://lovestorieswithjen.com ... https://www.thistleandpinephoto.com"
Light & Airy / True-to-Color: If you want lighter edits and posed + candid mixes, multiple recs surface. "Catherine Norwood ... did a great job! ... digital + analog film approach."

Specific Photographer Recommendations (community-tested)
--- reddit-02.txt: SOURCE: r/weddingplanning — "Best Colorado Wedding Photographer?" (posted 2y ago by Dependent-

=== PHOTOGRAPHER: Colorado Photography Squad | vendor_id=f71a0118-fb4b-43dc-9aec-afb217d08079 | bot=bot2 | date=10/2025 ===
# Colorado Photography Squad (?) — vendor_id=f71a0118-fb4b-43dc-9aec-afb217d08079
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Colorado Photography Squad | collective of photographers; under $2k for two hours of coverage

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"

Pricing Tips & Where To Find Lower Rates
Use targeted FB groups: Redditors repeatedly recommend wedding-specific Facebook groups to find cheaper or last-minute photographers. "There's a FB group called Colorado Elopements & Microweddings. TONS of photographers in there. I found a super-reasonably priced person!"
Post a clear brief + dedicated email: One strategy that worked: create a wedding-specific email and post exact budget and requirements to attract vendors who fit. "I got dozens of emails all with the info up front and found vendors for everything I was looking for."
Consider photography collectives or squads: These can offer lower rates or short-coverage packages. "Colorado Photography Squad! ... it was under $2k for two hours of coverage."

Practical Recommendations for Elopement

=== PHOTOGRAPHER: Jordan Gresham Photography | vendor_id=d2a8d9ff-abe9-4558-953a-3d0b2410e28a | bot=bot3 | date=5/2026 ===
# Jordan Gresham Photography (?) — vendor_id=d2a8d9ff-abe9-4558-953a-3d0b2410e28a
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"
Kate Merrill / KateMerrillPhoto: Recommended for efficient elopement shoots. "Kate Merrill was our Photographer—we got a lot shots in just two hours and I think her rare is less than that."
Samuel Marz: Mentioned repeatedly as willing to travel and documentary-minded. "I'm a Colorado Wedding Photographer ... www.samuelmarz.com"
Catherine Norwood: Noted for proposals and weddings with strong results. "Catherine Norwood did our proposal and she was the best! Photos turned out great."
Sasha Amelie / Amelie Photos: Called budget and travel friendly. "Sasha Amelie. Budget and travel friendly"
The Iris Photography / Rebecca Milan / Jordan Gresham / Amanda Berube: Suggested for editorial, luxe looks. "I went with The Iris Photography! ... Rebecca Milan Photography ... Jordan Gresham Photography .

=== PHOTOGRAPHER: Nick Sparks Photography | vendor_id=5d2957f4-3e95-4f6e-afa2-dcc1ca78a01d | bot=bot4 | date=7/2025 ===
# Nick Sparks Photography (?) — vendor_id=5d2957f4-3e95-4f6e-afa2-dcc1ca78a01d
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Nick Sparks Photography | micro wedding photographer; gave location recs and got permits

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"
Budget-friendly / Under ~$3k Options: Several threads point to more affordable photographers and tactics to find them. "I joined the facebook group 'Denver Brides on a budget' and posted ... got a handful of replies for less than $1k"

Trusted Local Names (frequently recommended):
Emily May / Emily May Photo: Frequently recommended for elopements and weddings. "Emily May is your girl"
Nick Sparks / Nick Sparks Photography: Multiple people praised his work and service. "We used Nick sparks for our micro wedding and he was fantastic."
Kate Merrill / KateMerrillPhoto: Recommended for efficient elopement shoots. "Kate Merrill was our Photographer—we got a lot shots in just two hours and I think her rare is less than that."
Samuel Marz: Mentioned repeatedly as willing to travel and documentary-

=== PHOTOGRAPHER: Rebecca Milan Photography | vendor_id=309fa837-ee3d-4aed-8db5-5132168ce78a | bot=bot5 | date=1/2025 ===
# Rebecca Milan Photography (?) — vendor_id=309fa837-ee3d-4aed-8db5-5132168ce78a
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"
Kate Merrill / KateMerrillPhoto: Recommended for efficient elopement shoots. "Kate Merrill was our Photographer—we got a lot shots in just two hours and I think her rare is less than that."
Samuel Marz: Mentioned repeatedly as willing to travel and documentary-minded. "I'm a Colorado Wedding Photographer ... www.samuelmarz.com"
Catherine Norwood: Noted for proposals and weddings with strong results. "Catherine Norwood did our proposal and she was the best! Photos turned out great."
Sasha Amelie / Amelie Photos: Called budget and travel friendly. "Sasha Amelie. Budget and travel friendly"
The Iris Photography / Rebecca Milan / Jordan Gresham / Amanda Berube: Suggested for editorial, luxe looks. "I went with The Iris Photography! ... Rebecca Milan Photography ... Jordan Gresham Photography .

=== PHOTOGRAPHER: Emily May Photo | vendor_id=4185b543-01d1-4ea4-bbc6-3c9ea3d68d1a | bot=bot6 | date=3/2025 ===
# Emily May Photo (?) — vendor_id=4185b543-01d1-4ea4-bbc6-3c9ea3d68d1a
site=https://emilymayphoto.com | google ?★ × ?

## site pricing/package lines
Colorado Elopement Pricing + Packages
Colorado Elopement Packages
I’m Emily, your Colorado elopement photographer & planner!
I LOVE love! I’ve photographed over 75+ couples’ wedding days, and there’s no better feeling than getting to give couples a truly spectacular elopement experience.
I’m here to be your resource on all things wedding and elopement planning. I’ll guide you through the planning process, and will act as an open book to you and your boo with all things planning.
My philosophy as an elopement photographer…
My approach to elopement photography is this: your experience is primary. When you are able to let go of stress, be fully present in your adventure, and truly be yourself? Those are the photos that bring every feeling and memory crashing back.
The Elopement Experience
We’ll chat about your vision, your priorities, potential locations, and overall what you want for your day. We’ll chat through what package option suits you best, get to know each other, and make sure you understand the process.
Get dreaming about your elopement day! I’ll send you questionnaires to gather allllll the info I can on what your dream day looks like. From there, I’ll create a custom Elopement Guide to give you TONS of ideas.
I’ll help you make definitive plans, including a timeline, map of locations, reservations, etc. In your custom Elopement Guide, you’ll have access to any and all information you’d like to know, including packing lists.
I’ll be a combo of secret-stealth-ninja and elopement-day-bestie, capturing moments quietly without intrusion, while helping support and encourage you throughout the day. Let’s go get your dress a little dirty!

## region pricing digests
- [launchintel] Emily May Photo | elopement specialist, ~$3k for 2hrs incl travel fee 5hrs outside Denver; packages start at $4k | emilymayphoto.com

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"
Specific Photographer Recommendations (community-tested)
Budget-friendly / Under ~$3k Options: Several threads point to more affordable photographers and tactics to find them. "I joined the facebook group 'Denver Brides on a budget' and posted ... got a handful of replies for less than $1k"

Trusted Local Names (frequently recommended):
Emily May / Emily May Photo: Frequently recommended for elopements and weddings. "Emily May is your girl"
Nick Sparks / Nick Sparks Photography: Multiple people praised his work and service. "We used Nick sparks for our micro wedding and he was fantastic."
Kate Merrill / KateMerrillPhoto: Recommended for efficient elopement shoots. "Kate Merrill was our Photographer—we got a lot shots in just two hours and I think her rare is less than that."
Samuel Marz: M

=== PHOTOGRAPHER: Francis Sylvest | vendor_id=5a6e7c92-e814-44af-b728-40e632afc71d | bot=bot7 | date=4/2025 ===
# Francis Sylvest (Boulder) — vendor_id=5a6e7c92-e814-44af-b728-40e632afc71d
site=https://francissylvest.com | google ?★ × ?

## site pricing/package lines
Wedding Photography Coverage From $6500
Wedding Videography Coverage From $7250
Engagement Session (Photography Only)
We can&#8217;t recommend his services enough for elopement photography and videography.&#8221;
With nine years of professional experience, Austin photographs wedding celebrations that include large multi-day events to elopements across the globe, with an emphasis in Colorado, Iceland, and New Orleans. His work garners a true to life, yet poetic take on the world that surrounds us.

## region pricing digests
- [launchintel] Francis Sylvest | local to Boulder; documentary forward | francissylvest.com
- [launchintel] Francis Sylvest | Minimum $6,500; 35mm and medium format photography, 16mm and Super 8 videography; covers Aspen, Telluride, Vail, Denver, Boulder and NYC; 9 years experience, also Iceland and New Orleans | https://francissylvest.com

## reddit
--- reddit-02.txt: SOURCE: r/weddingplanning — "Best Colorado Wedding Photographer?" (posted 2y ago by Dependent-Middle226, flair Wedding/Engagement Photos, 4 upvotes, 40 comments, locked)
edit: thank you everyone for the recs! we ending up going with Jared and Quinn photo and film :)

COMMENTS:

Lazy-Dragonfruit-377 (1y ago): Hey! We used Francis Sylvest! We actually got married Iceland but he's local to Boulder!
www.francissylvest.com
I'd also suggest checking out Sam Marz. He's in northern Colorado but willing to travel.
www.samuelmarz.com/

=== PHOTOGRAPHER: Hennessy Photo Co | vendor_id=7fd52247-4f18-4c23-9039-15260a966b71 | bot=bot8 | date=3/2026 ===
# Hennessy Photo Co (?) — vendor_id=7fd52247-4f18-4c23-9039-15260a966b71
site=https://hennessyphotoco.com | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Hennessy Photo Co | documentary style; local wedding photographer
- [launchintel] Hennessy Photo Co | Alternative documentary style | https://hennessyphotoco.com

## reddit
--- reddit-02.txt: SOURCE: r/weddingplanning — "Best Colorado Wedding Photographer?" (posted 2y ago by Dependent-Middle226, flair Wedding/Engagement Photos, 4 upvotes, 40 comments, locked)
Similar_Mushroom872 (2y ago): Alex Benavidez has a candid and documentary style

Ok_Chemistry7683 (2y ago): Alyssa Carpenter is amazing! www.alyssacarpenterphoto.com and her insta is alyssacarpenterphoto

Capable_Investment46 (1y ago): for documentary style, Hennessy photo co

mcbutter9 (9mo ago): Emma Rose photography is beautifullllll, she did our engagement session and several people have told me they are the most beautiful wedding-related photos they've ever seen https://emmarosephotography.pic-time.com/-mollycarter1/gallery

iimposter (6mo ago): We used Mark from By The West for our Beaver Creek wedding, he was able to do both photography and video for the day with his team too. Simply the best! H

=== PHOTOGRAPHER: Love & Lens | vendor_id=6538f389-333b-410e-a931-a7fefd7a6489 | bot=bot9 | date=1/2026 ===
# Love & Lens (?) — vendor_id=6538f389-333b-410e-a931-a7fefd7a6489
site=https://www.love-and-lens.com | google ?★ × ?

## site pricing/package lines
Our photos are AMAZING! So excited to get an album. You guys crushed it! — Ginny M. + Weston 3/9/24

## region pricing digests
- [launchintel] Love & Lens | Creative team of wedding photographers; distinctive wedding photography serving Boulder, Denver, Fort Collins, Pine, Estes Park and surrounding areas; also markets itself as an affordable option | https://www.love-and-lens.com

## reddit
--- reddit-06.txt: SOURCE: r/Weddingsunder10k — "Photographer recs in the Denver, CO area?" (posted 2y ago by HouDnv, 4 upvotes, 16 comments)
"My solution to this was to create an email address just for managing my wedding (literally last name.wedding@gmail). Then I posted on the fb group for brides in my state ("state name" brides). I explicitly wrote what I was looking for and included the email address for them to reach out. [...] I got dozens of emails all with the info up front and found vendors for everything I was looking for. [...]"

No_Resolution1077 (2y ago): I just recently joined the facebook group "Denver Brides on a budget" and posted looking for affordable photographers and got a handful of replies for less than $1k

wedgewoodweddings (2y ago, flair Vendor): Have you looked into Love & Lens or BlueSpruce Photography? They're both established Denver photographers with great

=== PHOTOGRAPHER: Samuel Marz | vendor_id=8bbf6166-79d4-44d9-848d-50d869b15e95 | bot=bot10 | date=5/2025 ===
# Samuel Marz (Fort Collins) — vendor_id=8bbf6166-79d4-44d9-848d-50d869b15e95
site=https://samuelmarz.com | google ?★ × ?

## site pricing/package lines
Typical venue cost: $20,000–$60,000 depending on event size
Typical venue cost: $10,000–$25,000 venue rental
Typical venue cost: $15,000–$35,000 depending on guest count
Typical venue cost: $15,000–$40,000 depending on event size
Typical venue cost: $10,000–$20,000 depending on guest count
Typical venue cost: $200–$500 permit fee
Many couples hosting weddings in Aspen spend between $70,000 and $200,000+ depending on the venue, guest count, and level of production involved.
Minimum of 8 hours of coverage
Engagement sessions and second photographer available
Wedding collections begin at $8,500.
For select dates, associate photography is available beginning at $6,500.

## region pricing digests
- [launchintel] Samuel Marz | in northern Colorado (Foco) but willing to travel; frequents Denver; no call required to book | samuelmarz.com

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"
Trusted Local Names (frequently recommended):
Emily May / Emily May Photo: Frequently recommended for elopements and weddings. "Emily May is your girl"
Nick Sparks / Nick Sparks Photography: Multiple people praised his work and service. "We used Nick sparks for our micro wedding and he was fantastic."
Kate Merrill / KateMerrillPhoto: Recommended for efficient elopement shoots. "Kate Merrill was our Photographer—we got a lot shots in just two hours and I think her rare is less than that."
Samuel Marz: Mentioned repeatedly as willing to travel and documentary-minded. "I'm a Colorado Wedding Photographer ... www.samuelmarz.com"
Catherine Norwood: Noted for proposals and weddings with strong results. "Catherine Norwood did our proposal and she was the best! Photos turned out great."
Sasha Amel

=== PHOTOGRAPHER: Sasha Amelie / Amelie Photos | vendor_id=b7062a61-2bb4-4b53-8053-50d609ad62c4 | bot=bot11 | date=7/2025 ===
# Sasha Amelie / Amelie Photos (?) — vendor_id=b7062a61-2bb4-4b53-8053-50d609ad62c4
site=https://amelie-photos.com | google ?★ × ?

## site pricing/package lines
Yes, absolutely! The standard turnaround time is up to 7-14 business days. But if you need your photos sooner, I offer a rush editing option — delivery within 2–3 days (not counting the shoot day) for an additional $300.
Yes, I’d be happy to! If your shoot takes place outside of NYC, I just ask for a travel fee to cover basic transport/time costs. Let me know where you’re dreaming of, and I’ll do my best to meet you there.
Yes, I can provide all the RAW files for an additional fee (from $100)
Photography Packages & Prices – NYC Lifestyle Sessions. Sasha Amelie | Lifestyle and Wedding Photography | NYC and Beyond
EVERY PACKAGE INCLUDES
Elopement | Wedding Photo Sessions
Elopement Style | Moments
A heartfelt NYC elopement session to capture your intimate “I do.”
Elopement Style | Storyline
Wedding | Full Day Unlimited
Wedding | Full Day Unlimited Team
• Lead and second photographers. 750+ edited images
• Flexible travel fee options
Event Documentary Package
• Each additional hour: from $300
• Custom Packages Available: I offer flexible options to meet your unique needs.
• Additional Hours: from $350 per hour for any package.
• Travel Fee: The travel fee is customized based on location for sessions outside the NYC subway network.
• Printed Photo Book: Starting from $400.
The $100 prepayment is non-refundable in case of cancellation. However, rescheduling the session to a different date is absolutely possible.
I reserve the right to share photos from our sessions on my website and social media. If you’d like the session to remain completely private and none of the images to be published online, there is an additional $50 fee for that option.

## region pricing digests
- [launchintel] Sasha Amelie / Amelie Photos | budget and travel friendly | amelie-photos.com

## reddit
--- reddit-01.txt: SOURCE: Reddit Answers (AI summary page), query "wedding photographers colorado"
Nick Sparks / Nick Sparks Photography: Multiple people praised his work and service. "We used Nick sparks for our micro wedding and he was fantastic."
Kate Merrill / KateMerrillPhoto: Recommended for efficient elopement shoots. "Kate Merrill was our Photographer—we got a lot shots in just two hours and I think her rare is less than that."
Samuel Marz: Mentioned repeatedly as willing to travel and documentary-minded. "I'm a Colorado Wedding Photographer ... www.samuelmarz.com"
Catherine Norwood: Noted for proposals and weddings with strong results. "Catherine Norwood did our proposal and she was the best! Photos turned out great."
Sasha Amelie / Amelie Photos: Called budget and travel friendly. "Sasha Amelie. Budget and travel friendly"
The Iris Photography / Rebecca Milan / Jordan Gresham

=== PHOTOGRAPHER: BlueSpruce Photography | vendor_id=d1456738-0c29-4f16-9031-8b159fd5142a | bot=bot12 | date=2/2026 ===
# BlueSpruce Photography (?) — vendor_id=d1456738-0c29-4f16-9031-8b159fd5142a
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## reddit
--- reddit-06.txt: SOURCE: r/Weddingsunder10k — "Photographer recs in the Denver, CO area?" (posted 2y ago by HouDnv, 4 upvotes, 16 comments)
"My solution to this was to create an email address just for managing my wedding (literally last name.wedding@gmail). Then I posted on the fb group for brides in my state ("state name" brides). I explicitly wrote what I was looking for and included the email address for them to reach out. [...] I got dozens of emails all with the info up front and found vendors for everything I was looking for. [...]"

No_Resolution1077 (2y ago): I just recently joined the facebook group "Denver Brides on a budget" and posted looking for affordable photographers and got a handful of replies for less than $1k

wedgewoodweddings (2y ago, flair Vendor): Have you looked into Love & Lens or BlueSpruce Photography? They're both established Denver photographers with great

=== PHOTOGRAPHER: Cassandra Summer Photography | vendor_id=3b5020a1-3b5e-4481-bd82-fbbe0184523d | bot=bot13 | date=2/2025 ===
# Cassandra Summer Photography (?) — vendor_id=3b5020a1-3b5e-4481-bd82-fbbe0184523d
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## reddit
--- reddit-07.txt: SOURCE: r/Denver — "Denver Wedding Photographer" (posted 6mo ago by igotlotioninmyeye, flair Recommendation, 0 upvotes, 42 comments)
https://kellymillerstudios.com https://www.aylaraeweddings.com https://www.thistleandpinephoto.com

mgithens1 (6mo ago): [story about handing a pocket camera to a 6-7 year old at a friend's wedding — crowd-sourced photos tip, no vendor]

muchmaligned (6mo ago): Cassandra Summer Photography - she's a friend and my wife and I are the header image on her Facebook business profile so I may be a little biased, haha. Great person, lovely to work with and did an incredible job for our wedding. She did a combination of candids and posed photos for us.

orangepekoe_51 (6mo ago): Shelly has that airy but real life color vibe that may be what you're looking for! She's our photographer for our wedding this coming June and took our engagement pictures

=== PHOTOGRAPHER: Emma Rose Photography | vendor_id=42d38d4d-d991-47ba-a2f4-a22cd220e7e5 | bot=bot14 | date=1/2026 ===
# Emma Rose Photography (?) — vendor_id=42d38d4d-d991-47ba-a2f4-a22cd220e7e5
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Emma Rose Photography | engagement session photos widely praised

## reddit
--- reddit-02.txt: SOURCE: r/weddingplanning — "Best Colorado Wedding Photographer?" (posted 2y ago by Dependent-Middle226, flair Wedding/Engagement Photos, 4 upvotes, 40 comments, locked)
Ok_Chemistry7683 (2y ago): Alyssa Carpenter is amazing! www.alyssacarpenterphoto.com and her insta is alyssacarpenterphoto

Capable_Investment46 (1y ago): for documentary style, Hennessy photo co

mcbutter9 (9mo ago): Emma Rose photography is beautifullllll, she did our engagement session and several people have told me they are the most beautiful wedding-related photos they've ever seen https://emmarosephotography.pic-time.com/-mollycarter1/gallery

iimposter (6mo ago): We used Mark from By The West for our Beaver Creek wedding, he was able to do both photography and video for the day with his team too. Simply the best! Highly recommend. They're based in Denver.
www.bythewest.co

=== PHOTOGRAPHER: Lauren Crumpler Photo | vendor_id=a426e60d-bce3-4c48-8a8b-1aa9483cab1a | bot=bot15 | date=2/2026 ===
# Lauren Crumpler Photo (?) — vendor_id=a426e60d-bce3-4c48-8a8b-1aa9483cab1a
site=none | instagram=@lauren.crumpler.photo | google ?★ × ?

## site pricing/package lines
(none found on site)

## reddit
--- reddit-04.txt: SOURCE: r/Eloping — "Colorado Elopement Photographer" (posted 1y ago by Designer-Fun-2765, flair Budget, 5 upvotes, 20 comments)
[deleted] (1y ago): Take a look at Colorado Photography Squad! They have a host of photographers and our photographer Kate was awesome and it was under $2k for two hours of coverage.

CoatLegitimate301 (1y ago): Check out Savannah she's always out there and does amazing work https://www.savannahchandlerphotography.com (she lives near me and is an amazing human being in general too)

audreydarkephoto (1y ago): Not sure of her exact pricing, but Lauren Crumpler Photo is based in CO and great to work with!
https://www.instagram.com/lauren.crumpler.photo/

[several comments removed by moderators — vendor self-promotion not allowed]

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-01.csv
