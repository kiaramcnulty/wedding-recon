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


=== PHOTOGRAPHER: Allison Ragsdale Photography | vendor_id=226a5022-f899-4529-85ce-3680d1bfe72f | bot=bot14 | date=11/2025 ===
# Allison Ragsdale Photography (Durango) — vendor_id=226a5022-f899-4529-85ce-3680d1bfe72f
site=http://www.allisonragsdalephotography.com/ | google 5★ × 96

## site pricing/package lines
Complimentary Engagement Session in the Durango area (with full-day coverage) is included, so you get comfortable with us!
Adorn your walls, create an album, and send out prints to your friends and family. Display your pictures anywhere to be reminded of how beautiful your life is.
We’ve been doing weddings for more than a decade in Durango, and we know every detail you’ve dreamed of is important. For that reason, each of our packages includes planning consultations.
DURANGO WEDDING PHOTOGRAPHY PRICING
Essential Collection
Up to 4 hours of coverage on your wedding day
Add additional photographer for $500
Up to 6 hours of coverage on your wedding day
Complimentary Engagement Session
Luxury Wedding Album
Is Doing an Engagement Session Necessary?
You are a representative of your brand, and it starts with a great headshot. People like to know the face behind the name! Beyond that, a great headshot is a marketing tool that gives you an excellent return on your investment. You never know what doors it can open!
Do you offer portrait photography packages?
Durango's Best Elopement Photography - Durango Wedding and Family Photographers
Durango Elopement Photography
Durango Elopement Photography allisonragsdale 2025-06-09T18:36:45+00:00
Our goal as Durango elopement photographers is to create classic, candid, and romantic photos that transport you back to your elopement every time you see them on your walls.
Our elopement photos are about love, no doubt…but they are also about vistas and views and vows.

## google reviews (top 3)
- (5★ 2019-10) Allison photographed our wedding and we're so happy we chose her to capture our special day. Our photos turned out better than we could have hoped for. She was incredibly easy to work with! It was really important to me that the photos captured the beauty of Colorado, and she went above and beyond my expectations. She took us to some breathtaking spots around Lake Vallecitos and the pictures turne
- (5★ 2019-07) Allison is absolutely an incredible, professional and wonderful photographer! We were highly recommended to her - and were extremely impressed with every single step of the process as well as the beautiful gallery now on our wall. From the informative videos and emails, to the fun photo sessions, to the swift order fulfillment, to the beautiful art and photography - she makes it easy, fun, and enj
- (5★ 2020-03) Allison, Matt & their crew are FABULOUS! My daughter is graduating this year from DHS, so we participated in the Senior Portfolio program. What a treat this was! 12 months of photography sessions, some group, some individual, all AMAZING! I have the most BEAUTIFUL pictures of my daughter, and great memories of the photo shoots. The family session, which was included in the program, was so much fun

=== PHOTOGRAPHER: Alton Richardson Studios | Boulder Wedding Photographer | vendor_id=027d6b95-56b5-496e-a766-66a7de46c5a4 | bot=bot15 | date=5/2026 ===
# Alton Richardson Studios | Boulder Wedding Photographer (Boulder) — vendor_id=027d6b95-56b5-496e-a766-66a7de46c5a4
site=http://www.altonrichardsonweddings.com/ | google 5★ × 19

## site pricing/package lines
Weddings &mdash; Alton Richardson Weddings | Colorado Weddings & Elopements
Colorado Elopement & Wedding Photographer
Weddings / Elopements / Engagements
Colorado Wedding Photographer &mdash; Alton Richardson Weddings | Colorado Weddings & Elopements
Alton Richardson Weddings | Boulder Wedding & Elopement Photographer
WEDDING & ELOPEMENT PHOTOGRAPHER
Available for weddings & elopements in Colorado, Wyoming, New Mexico & travel elsewhere.
Contact & Bookings | Wedding photography packages &mdash; Alton Richardson Weddings | Colorado Weddings & Elopements
After a 30min video call, a couple signatures and a 33% non-refundable retainer locks in your date.
What are your rates?
Local (Front Range Area) photography coverage starts at $2 200 and Elopement/Micro Wedding coverage starts at $900. I also have options for engagement and couples sessions. Reach out via my contact page to learn more.
Elopements &mdash; Alton Richardson Weddings | Colorado Weddings & Elopements
Engagements &mdash; Alton Richardson Weddings | Colorado Weddings & Elopements

## google reviews (top 3)
- (5★ 2025-12) Planning a wedding was one of the most stressful things I have ever done in my life. However, I can say with great confidence that having Alton as our photographer made our wedding experience so much easier, lovelier and more memorable than I could have ever imagined. I was firstly so impressed by his professionalism and attention to detail during the planning process— but the greatest part about 
- (5★ 2026-06) Alton did both our engagement photos and our wedding photos. He is such a talented photographer. Neither of use are what we would describe as photogenic and he did such an amazing job of putting us at ease. The photos turned out great with his coaching and getting us to chill. We didn't have ideas for where we wanted to do out photo shoots and he handled everything. It was so nice to put our trust
- (5★ 2025-10) Alton took our wedding pictures in May 2025, and he was amazing! Him and his associate where so much fund to work with, and our family had wonderful interactions with him during the wedding. We aren’t usually big picture takers, but taking our portrait shots turned out being one of the most enjoyable parts of the wedding day! Alton is very professional and such a joy to work with. Not to mention,

=== PHOTOGRAPHER: Amanda Matilda Photography | vendor_id=67ca2f64-301b-47f5-be11-616fff777987 | bot=bot16 | date=6/2025 ===
# Amanda Matilda Photography (Grand Junction) — vendor_id=67ca2f64-301b-47f5-be11-616fff777987
site=http://www.amandamatildaphotography.com/ | google 5★ × 42

## site pricing/package lines
Pricing | Grand Junction Photographer Amanda Matilda
Blog Pricing elopement
elopements elopements
Branding photos Elopement Planning
Elopements, weddings, couples photos, adventure sessions and more...
I offer photography for elopements and weddings around Western Colorado and Utah (and beyond!) I love capturing and preserving moments for micro weddings, engagement photos, adventure sessions and more as well.
Click below for info & Pricing
Since starting my business in 2012 and moving here in 2015, I've been helping couples navigate the beautiful chaos of planning and photographing elopements across Colorado's Western Slope, San Juan Mountains, and Moab, Utah.
Western Colorado & Moab Elopement Specialist
Fill out my contact form below and I'll send over my specific pricing guide for the services you're interested in. From there we'll meet by phone/Zoom to make sure we're a good fit! Once you know I'm the one for you, I'll send over an invoice and agreement by email to save your date.
VIEW ALL ELOPEMENT RESOURCES
Ultimate Elopement Planning Guide
You want a photographer who's invested in your experience , not just executing a shot list.
You can add on an Heirloom Album at any time, full of photos that tell the story of your day. You can flip through its pages and relive those moments you long for from the day. No more realizing years down the road you never did anything with your wedding photos!
"We have been passing around our photo album with family over the last couple days and everyone is loving it. We wanted to thank you again for your work!"

## google reviews (top 3)
- (5★ 2024-12) Amanda went above and beyond for my elopement photos. I honestly cannot praise her enough. She was so communicative and responsive during the lead up to our ceremony. She answered all our questions about locations, vendors, and working with the national parks to get permits. On the day of our ceremony, she kept all our guests in order and directed everyone so that we got all the group shots we wan
- (5★ 2025-09) Amanda photographed our wedding and was so wonderful to work with! Professional, super responsive and on top of things, answered all of my many questions patiently and thoroughly and helped us figure out our timeline, and was all around a fantastic person to have on our wedding team. Our photos are so gorgeous and we're so excited to display them in our home ❤️
- (5★ 2025-10) Beautiful photos and such a nice person! Amanda is a very talented photographer who guided us through the entire elopement process via helpful emails and meetings. All of our friends and family can't stop telling us how amazing our photos are. I am not great at posing and don't take many photos of myself, but with Amanda I felt at ease and she was so good at telling us how to pose and what to do.

=== PHOTOGRAPHER: Andrea Stark Photography | vendor_id=86ab9261-aaf9-4067-ba01-77fa78b3b57e | bot=bot17 | date=9/2025 ===
# Andrea Stark Photography (Breckenridge) — vendor_id=86ab9261-aaf9-4067-ba01-77fa78b3b57e
site=http://andreastarkphoto.com/ | google 5★ × 39

## site pricing/package lines
I offer full day wedding coverage in mountain areas throughout Colorado and beyond. This includes getting ready, the wedding ceremony, wedding party and family photos, newlywed portraits, the reception, and all the gorgeous details you’ve planned along the way.
SHOP ELOPEMENT PLANNING RESOURCES
Intimate Weddings and Elopements
I&#8217;m so proud to offering small, intimate weddings, micro weddings, and elopements with my associate company Bound for the Mountains . Please inquire for more information about working with myself or a member of my team.
The weddings I capture are usually destination, multi-day events. I work with you to customize your photography collection specifically for your event. Inquire for a custom proposal with travel included.

## google reviews (top 3)
- (5★ 2021-02) My husband and I could not have asked for a better wedding photographer!! We hired Andrea to capture our intimate, low-key ceremony this past January in the mountains. We were excited to work with her from the very first phone call, and immediately felt comfortable with her photography expertise, local knowledge of the mountains, and energetic personality. And when our original plans were altered 
- (5★ 2024-11) Andrea was truly the best wedding photographer we could have ever asked for. Prior to the wedding she was so enjoyable to work with, so communicative, and partnered great with my wedding planner Kira Barczy. Day of the wedding, Andrea did an amazing job shepherding the craziness that comes with wedding day. Her and her team did a great job organizing everyone and ensuring all photos were captured.
- (5★ 2020-10) Last minute travel from Iowa, Andrea was amazing to work with! My Fiancé and I decided to get our engagement photos taken out there since we want to get married in CO. It was only two weeks away from our trip when I reached out to Andrea and she confirmed right away that she'd love to work with us. I informed Andrea that I would need help with outfits and we wouldn't know how to pose, she put me a

=== PHOTOGRAPHER: Antler Run Photography | vendor_id=8a8b6a26-d46d-461e-a09a-525a00b47c89 | bot=bot1 | date=7/2025 ===
# Antler Run Photography (Littleton) — vendor_id=8a8b6a26-d46d-461e-a09a-525a00b47c89
site=http://www.antlerrunphotography.com/ | google 5★ × 53

## site pricing/package lines
Portrait Collections
Antler Run Photography is a nod to where this all began... the Colorado wilderness, the wildlife, and the wild beauty that still inspires every frame I capture. It's why every wedding collection is named after Colorado's native wildlife. A little reminder of how we got here.
What's included in each package?
Each collection is carefully built to give you everything you need for your day — two photographers, a hand-edited gallery, a heirloom album, and more. Full details on every collection are on our Wedding Collections page.
Your sneak peek collection arrives within 72 hours of your celebration. Complete galleries are delivered within 8–10 weeks, as each image is personally hand-edited to ensure consistency, beauty, and authentic storytelling. No shortcuts—only care and craftsmanship.
Once we've had our consultation and you're ready to move forward, I'll send over a contract and your retainer invoice. Sign the contract, pay the retainer, and your date is locked in.
My wedding collections start at $4,500 and are built around giving you two photographers, a heirloom album, and images you'll love forever — no hidden fees, no surprise upsells. Full details on every collection are on the Wedding Collections page.
A 20% retainer reserves your date, with the remaining balance due 30 days before your wedding. I accept Venmo, Zelle, and all major credit cards. Payment plans are available — just ask.
Wedding Investment - Antler Run Photography
See Our Wedding Collections
Wedding and Elopement Collections

## google reviews (top 3)
- (5★ 2023-12) If you are looking for an amazing photography (and videography) team, Christine and Mike are your people! We picked Antler Run because of Christine’s considerate initial communication and portfolio highlighting my desired moody editing style, and we’re so glad we did! Throughout the whole process, they were incredibly responsive and happily answered any of our questions. We had an amazing engageme
- (5★ 2025-12) We truly could not have asked for a better wedding photographer than Christine! From the very first interaction, she was incredibly personal, kind, and easy to work with. Communication was effortless; she made it so easy to reach out, ask questions, and feel confident throughout the entire planning process. Since we came from out of state and planned a small elopement, having someone we could full
- (5★ 2026-03) Christine photographed our wedding in Lyons in January 2026. Things we loved about working with Christine: She met with us before we hired her (in-person at a brewery we chose close to our home in Boulder) to talk through her work style and vibe. She responded super quickly via email leading up to the event. Christine brought a very calm and chill energy to our wedding. Afterward, she mailed us a 

## region pricing digests
- [launchintel] Antler Run Photography | Classic style; starts at $4,500; honest moments, true color, real connection

=== PHOTOGRAPHER: Ash Marie Photography | vendor_id=2a525b93-4e5f-488b-9001-f81ad91830ea | bot=bot2 | date=2/2026 ===
# Ash Marie Photography (Erie) — vendor_id=2a525b93-4e5f-488b-9001-f81ad91830ea
site=http://www.ashmarie.photography/ | google 5★ × 56

## site pricing/package lines
Colorado Photographer Pricing &mdash; Ash Marie Photography

## google reviews (top 3)
- (5★ 2021-11) Ashley is the absolute best! She has a wonderful eye for capturing precious family moments. Every time I have had family photos taken by Ashley I am over the moon with the results! I am so grateful that we have found a photographer that puts so much creativity and thought into each session. She has captured my gender reveal, baby shower, newborn shoot and fall family session and the photos were in
- (5★ 2021-11) Ashley was recommended to us by a few friends and we are so thankful she took our family photos this year! She did a remarkable job of making my three young children feel comfortable and captured each of them perfectly. She did a great job of balancing candid photos with posed pictures to give us a wonderful variety. She has a magical way of finding the perfect angle, lighting and of course expres
- (5★ 2022-05) Absolutely in LOVE with the photos we got from Ash Marie Photography. I'm not one to normally do professional photos, but I am so thrilled that we did for both of my newborns. The photos are really stunning and I'm amazed that Ashley was able to capture so many of my toddler not in mid tantrum or sucking his thumb, which is so tough! Ashley is great to work with, she makes you feel really comforta

=== PHOTOGRAPHER: Austin James Photography | vendor_id=3e6fef5f-7343-464d-9349-67830329c21d | bot=bot3 | date=4/2026 ===
# Austin James Photography (Denver) — vendor_id=3e6fef5f-7343-464d-9349-67830329c21d
site=https://austinjphoto.com/ | google 5★ × 26

## site pricing/package lines
Denver Wedding Photographer | Investment and Packages
WHY INVEST IN PHOTOGRAPHY?
Ah everyone’s favorite part.. talking about the money. But let’s talk about the word investment for a moment. I’ve never liked the words pricing or cost.. this is about what you want to get out of the money that you are putting in. And photos are just the half of it!
WEDDING PHOTOGRAPHY PACKAGE
Complimentary engagement session
100-150 images per hour of coverage
Average package spend - $4100
MICROWEDDING & ELOPEMENT PHOTOGRAPHY PACKAGE
75-125 images per hour of coverage
Average package spend- $2500
Average package spend - $600
DENVER WEDDING PHOTOGRAPHER | COLORADO WEDDING PHOTOGRAPHER | COLORADO ELOPEMENT PHOTOGRAPHER | DESTINATION WEDDING PHOTOGRAPHER
Your Engagement Session!
I am based out of Denver, Colorado but I do weddings all over Colorado and beyond! For anything out of state my travel fees typically only include plane ticket/gas and room & board. No extra frills involved!
With USB starting to become a thing of the past, I do everything digital these days! You’ll receive a full online gallery that stays up for a year so you can download them at any time. The gallery also has a store for any prints, canvasses, or albums you may need!

## google reviews (top 3)
- (5★ 2026-01) Austin went above and beyond for us and we could not be more grateful that we were partnered with him! My now-husband and I are not often in front of cameras but our engagement session and wedding day photos would have you think otherwise. We were definitely awkward (lol) but were gently guided into positions/places and were able to laugh as we figured out what to do and how to make the experience
- (5★ 2025-03) A little late in writing this review—we've been enjoying life in wedded bliss! Austin was our wedding photographer last May, and truly, he was exceptional. From the very beginning, he had such a thoughtful approach. He met with us beforehand and also took our engagement photos, which gave us the chance to hang out and get comfortable with him. By the time our wedding day arrived, it felt like we h
- (5★ 2025-07) From the moment we met Austin, we knew we'd chosen the right photographer. He is responsive, professional, organized, and so personable. We didn't have an engagement photo location in mind, so he suggested a beautiful spot that checked all the boxes. During the session, he talked us through how he'd shoot the wedding and gave us tips to make day of photos easier. On wedding day, Austin kept things

=== PHOTOGRAPHER: Authentic Moments Media | vendor_id=6fea9902-2aca-4b71-864f-660925086d52 | bot=bot4 | date=2/2026 ===
# Authentic Moments Media (Fort Collins) — vendor_id=6fea9902-2aca-4b71-864f-660925086d52
site=https://authentic-moments.com/ | google 5★ × 22

## site pricing/package lines
Photo &#038; Video Pricing
Booking a wedding or engagement session with us is an incredibly easy process. We ask for a 40% retainer up front, and the remainder of the balance can be paid at any point up to 4 weeks before your wedding date.
Which package is best for us?
We like to have an initial consultation with all our couples before booking with us. It&#8217;s during this process we&#8217;ll get to know you, gather information on your wedding day and make recommendations based on your needs. You can view our pricing and services here.
We provide photo and video coverage throughout all of Colorado and parts of Wyoming and Nebraska. Do you have a destination wedding? Contact us and we&#8217;ll put together a custom package for you.
PRICE & AVAILABILITY!
Photography Pricing - Authentic Moments Media
Home » Photography Pricing
Booking a quality wedding photographer couldn’t be easier or more affordable.  Browse our packages and different add-on’s below.
All photo packages allow clients to order prints and specialty products!
Local Engagement Session (Standalone Price)
Local Engagement Session (Bundled Price)
Please note &#8211; Our Elopement and Ceremony-only packages are not available for Saturday or holiday-weekend weddings.
Please note &#8211; Our Elopement packages are not available for Saturday weddings.
Wedding Photography Pricing | Authentic Moments CO
Booking a quality wedding photographer & videographer couldn’t be easier or more affordable. Browse our packages bundled packages below.

## google reviews (top 3)
- (5★ 2025-07) We met the wonderful people at Authentic Moments during a wedding expo and were first impressed by their friendliness and ability to answer our many questions. What really sold us was when we mentioned the venue we were getting married at and they pulled up a video they had done there as an example of their work. When we booked them, we had a meeting with Cylina who went over all the details and w
- (5★ 2026-05) We used Authentic Moments for our wedding in Estes Park and the experience was extraordinary. Cylina was great to work with and helped coordinate everything for the big day. Gretchen was our main photographer, and Rocco was our videographer, and they were amazing. They were kind, caring, fun, and made our day so special. They went above and beyond to help us capture our dream wedding. We got marri
- (5★ 2024-09) Sean and his team are AMAZING!! Our video and photos came out STUNNING! We were fortunate enough to win our package in a giveaway, but that in no way changed the quality of our products. We are still getting compliments on our photos and we were married 05.04.24 :)

=== PHOTOGRAPHER: Authentic Moments Photography | vendor_id=3b631b73-e81d-49b7-b324-410d53bc6c6f | bot=bot5 | date=3/2026 ===
# Authentic Moments Photography (Centennial) — vendor_id=3b631b73-e81d-49b7-b324-410d53bc6c6f
site=https://authmo.co/ | google 5★ × 114

## site pricing/package lines
For elopements, quick vows, or just keeping it simple.
Venues more than 30mi from Inverness, CO subject to a $1.25/mi travel fee
Want to customize a package? Just ask!
Andrew was an incredible addition to our special day. Amazing pricing, very

## google reviews (top 3)
- (5★ 2026-02) Andrew is a gifted photographer! The photos he took of our wedding far exceeded our expectations, and his professionalism made the entire experience feel easy and well worth the affordable rates. My partner and I are already discussing our next photo shoot with Authentic Moments Photography! Can’t recommend enough!
- (5★ 2026-05) Absolutely amazing! He made the whole process so much easier and made sure that the event went even more perfectly than I could have imagined. He went above and beyond in every way imaginable and I will forever be grateful for all his help. He made the whole thing feel personal and easy while maintaining the professional feel. Made sure to take the time to get to know us a little bit in order to m
- (5★ 2026-04) I cannot overstate how fantastic Andrew was to work with. My partner and I had never been photographed before and with it being a more intimate shoot we felt very nervous but Andrew put us right at ease with a friendly demeanor and tons of helpful tips. I'm so so happy with the pictures we got, I feel like he really captured our dynamic and brought our vision to life!! I also appreciated his flexi

=== PHOTOGRAPHER: Be Boulder Photography | vendor_id=c306dcc8-d80a-454a-be92-a834987b5f67 | bot=bot6 | date=3/2025 ===
# Be Boulder Photography (Boulder) — vendor_id=c306dcc8-d80a-454a-be92-a834987b5f67
site=http://www.beboulderphotography.com/ | google 5★ × 129

## site pricing/package lines
Commercial Photography Investment &raquo; Be Boulder Photography
- Elopement Inquiries
- Engagement Sessions
Pricing &raquo; Be Boulder Photography
Here's a little information on my pricing. I offer 30, 60, 90 and 120 minute sessions, with half and full days available upon request as well.
And best of all, pricing includes beautifully edited, high-resolution, digital files!
Weddings & Elopements
• Elopements start at $2000
• Weddings start at $4000
* Second photographer
Meet Madison and Annah, my amazing second photographers! I always bring them for my own peace of mind, as well as yours. It makes the day run so much smoother, and you will have more moments to savor.
If you’d like to hire me, a deposit of 50% will hold your date. The remainder will be due 30 days before your wedding. If the lump sum doesn't work with your budget, I offer payment plans using monthly or quarterly automatic withdrawals leading up to your event.
Absolutely loved working with Eleanor and our pictures were absolutely stunning. They are an investment and something to cherish long after our wedding is over, which is why we reached out to Be Boulder Photography. I could not recommend them enough! —Mallory Tanner
Colorado Elopement Photographer &raquo; Be Boulder Photography
BOULDER ELOPEMENT PHOTOGRAPHER
If you book me, I'll help you and your partner develop a timeline that works for you, and fits your style as a couple. On your elopement day, I'll be flexible and creative, spending our time however you would like.
All elopement bookings include:

## google reviews (top 3)
- (5★ 2025-08) Eleanor took such great photos of our family and our son absolutely loves his senior pics! She made the whole experience just fun, easy and enjoyable. Eleanor has an eye for the perfect shot and did such a good job leading us to beautiful spots and keeping the whole vibe positive and relaxed. I can’t recommend Eleanor enough for any photography purpose…senior pics, family photos, headshots or wedd
- (5★ 2025-09) My fiancé and I just received our pictures today. I started crying the moment I saw the first photo. Not only are the photos gorgeous but the experience was nothing but extraordinary! For starters, we booked a 30 min. engagement shoot and are from out of state (Florida & Texas). The evening scheduled for photos had rain in the forecast. Eleanor the photographer kept us updated on when the rain wou
- (5★ 2024-11) This is the 2nd time I've had the opportunity to work with Eleanor and this time she captured special and intimate moments of my extended family!!! The pictures are absolutely stunning (I can't stop looking at them), creative and so fun! There were 12 of us in this photo shoot and it went off seamlessly, even with 3 babies and a pre-schooler! Eleanor is friendly and professional and so easy to wor

## region pricing digests
- [launchintel] Be Boulder Photography | Emotive storytelling and heartfelt portraits; welcoming locals and visitors; also does family photography | https://beboulderphotography.com

=== PHOTOGRAPHER: Beaton Photography | vendor_id=071af957-edc2-4a2c-9662-f1082887ffb9 | bot=bot7 | date=2/2025 ===
# Beaton Photography (Boulder) — vendor_id=071af957-edc2-4a2c-9662-f1082887ffb9
site=http://www.beatonphotography.com/ | google 5★ × 41

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2022-10) Kay has been taking photos for our family for over 13 years. We first hired her as our wedding photographer in 2009. She did an amazing job capturing our wedding day from beginning to end. We’ve continued to hire Kay to take family photos over the years. She has photographed our twins since they were babies and always captures the most beautiful images of them. She even does a great job with the f
- (5★ 2022-10) Absolutely amazing! Kay is the only person who can capture my true essence through photography. First she was our wedding photographer, and just recently did some photography for my business. She's professional and fun, and the result is authentic photography. Highly recommend her!
- (5★ 2019-10) Kay has been our family photographer for nearly 7 years. We adore her!! She has taken so many different types of pictures for us -maternity, newborn, young children portraits, couples, family and extended family (like BIG extended family) pictures. We have loved them all. She meets all the criteria for professionalism - punctuality, fair pricing, reliability and an easygoing, fun personality. More

=== PHOTOGRAPHER: Belleview Weddings & Events | vendor_id=be37790e-9d72-4ae2-881c-60e3d842d253 | bot=bot8 | date=8/2025 ===
# Belleview Weddings & Events (Crested Butte) — vendor_id=be37790e-9d72-4ae2-881c-60e3d842d253
site=http://www.belleviewevents.com/ | google 5★ × 32

## site pricing/package lines
Elopement Services &#8211; Belleview Weddings and Events
Elopement services are offered in a similar manner as Belleview&#8217;s main event service but with a lower minimum. Jamie will handle all vendor bookings, set up, breakdown and delivery to your one-of-a-kind elopement.
Full Service Package:
Partial Service Package:
Day of Coordination Package:
Planning Only Package:
Floral Service- bouquets, centerpieces, etc.  BW&E has an in-house florist to meet your needs.  Our prices are fair and affordable.
Venue Touring service: for clients who do not live in Crested Butte.  I will tour venues and take photos for you and send you a package of images, details, costs, etc about each venue.
Welcome package creation and delivery
If there is something that you don&#8217;t see on this list but would like to inquire about please send Jamie an email!  Custom packages and services are always available.

## google reviews (top 3)
- (5★ 2019-05) Jamie is incredible! We started off saying we were going to have a small, simple wedding and we ended up morphing it into a huge event with a million moving parts. Jamie handled it all with so much grace and brought to life everything we imagined. Jamie's calming presence was such a gift to us when we were in planning mode and also as we navigated multiple events on our wedding weekend. On our wed
- (5★ 2018-02) Jamie is a wedding planning wizard and should be your first choice for a wedding/event planner in the beautiful Crested Butte - Gunnison, Colorado region. From our initial meeting through the day after the wedding, she was SO helpful, organized, and fun to work with. She responded to all of our communication promptly and always had ideas, solutions, or local vendor recommendations to our wedding q
- (5★ 2018-11) We had an amazing experience working the Belleview Weddings & Events! Jamie is an absolute pro. As wedding vendors ourselves (photographers), we know what to look for in professional wedding services... Belleview Events provides a top-notch service with a friendly and personable attitude. If you want someone who can handle all your details with a go-with-the-flow attitude, then Jamie is your girl!

=== PHOTOGRAPHER: Blue Spruce Photography | vendor_id=cf5f5f1a-23e7-4141-9561-f916e6c1116b | bot=bot9 | date=6/2025 ===
# Blue Spruce Photography (Lakewood) — vendor_id=cf5f5f1a-23e7-4141-9561-f916e6c1116b
site=http://bluespruceweddingphoto.com/ | google 5★ × 52

## site pricing/package lines
That is the kind of wedding photographer you can expect to work with here at Blue Spruce Wedding Photography. We combine creativity and passion together to make sure that every shot we take deserves a space on your wedding album, wall, and heart.
Furthermore, we also offer custom packages. We can deploy second photographers and videographers if you wish. We can also provide high-quality wedding albums so you won&#8217;t have to worry about compiling a wedding photobook on your own.
Let Us Create Your Unique Package &#8212; Contact Us!
The best way to create a wedding photography package that suits your preferences and wedding details is to request a quote and get in touch with us so we can set a meeting to discuss your needs. Fill out our form or call us at 720-635-7611 today!
I'm so thrilled with how our engagement and wedding albums turned out, and would hire him again in a heartbeat. Beau is truly an artist and perfectly captured our special day!
Beau was awesome! He did a great job for both engagement and wedding photos, gave a very reasonable pricing and offered to make additional editing after the wedding! I will definitely recommend him to my family and friends! Thank you Beau!

## google reviews (top 3)
- (5★ 2025-12) We booked Blue Spruce for wedding and engagement photos after meeting Beau at the RMBS. We just had our wedding this past July and are so happy with how everything turned out! Photography was one of our highest priorities for our wedding, and are SO glad we went with Blue Spruce!! Beau is very responsive to emails and has lots of great ideas for photo locations, both for the engagement pics and ne
- (5★ 2025-12) Beau at Blue Spruce Photography was the best photographer we could have asked for at our recent wedding. Beau was our preferred photographer at Ken Caryl Vista and we quickly understood why. His attention to detail and ability to capture every shot you hoped to get is astounding. Beau was quick to respond and worked with us on our every request. He is also amazing at getting you photos back in a r
- (5★ 2026-05) We worked with Beau for both our engagement photos and wedding day pictures and couldn't have been happier with how well everything went and how fantastic the pictures are! We've had people tell us our engagement photos belong in a magazine and that the love just leaps out of our wedding day pictures! In addition to his amazing work Beau was always easy to work with, helping keep us on track, reco

## region pricing digests
- [launchintel] Blue Spruce Photography + Videography | Starting at $2,300 (per The Knot); photo + video, serves statewide CO and Rocky Mountain region

=== PHOTOGRAPHER: Bob Younger Images | vendor_id=9b92adbb-d33b-4721-b591-ad06ebc6fd35 | bot=bot10 | date=7/2025 ===
# Bob Younger Images (Fort Collins) — vendor_id=9b92adbb-d33b-4721-b591-ad06ebc6fd35
site=https://www.bobyoungerimages.com/?utm_source=google&utm_medium=organic&utm_campaign=googlemybusiness | google 5★ × 58

## site pricing/package lines
Most headshot sessions run about 30 minutes, depending on the package you select. Make sure to ask about our branding sessions! Branding sessions are more extensive and often include different locations, they are very customized just for you.
Each package includes a set number of fully retouched images. Typically, 5-10 images are delivered in both color and black and white &ndash; Bob often over delivers on his headshots! You can always purchase extras if you need more.
Yes. I photograph teams, staff, and full offices &mdash; either at your location or in-studio. Custom pricing available. Also consider a team headshot party.
Weddings & Elopements

## google reviews (top 3)
- (5★ 2026-01) Bob Younger Images was fantastic to work with. He just did our work photo shoot and absolutely nailed it. Super professional, easygoing, and made the whole process smooth and comfortable. He gave great direction, moved efficiently, and delivered quality images that actually feel natural and polished—not stiff or awkward. If you want someone who knows what they’re doing and makes it easy, Bob’s you
- (5★ 2025-01) My family and I had the best experience with Bob! He is a talented photographer and an even kinder person. He took special care to make sure we liked our photos and presented us in a beautiful light. We would enthusiastically recommend him for your next photography project.
- (5★ 2025-01) My family and I worked with Bob to take a family portrait and he is the best! He made the experience so fun and seamless. I absolutely love how the photos turned out and on top of that Bob is just truly the nicest person ever! Would recommend 10/10. :)

=== PHOTOGRAPHER: Boho Chic Boudoir by Kara Cavalca | vendor_id=a4c8c9a1-ff51-4ad2-a7c5-848896bccc20 | bot=bot11 | date=1/2026 ===
# Boho Chic Boudoir by Kara Cavalca (Durango) — vendor_id=a4c8c9a1-ff51-4ad2-a7c5-848896bccc20
site=http://www.bohochicboudoir.com/ | google 5★ × 10

## site pricing/package lines
PRICING AND INVESTMENT
Check out more details about pricing on my Pricing and Products page.
PRICING AND PRODUCTS | Boho Chic Boudoir by Kara Cavalca
Expect to spend around 3-7 hours, depending on your package, from the moment you arrive for hair and makeup (or to start your shoot if you are opting out of hair and makeup) to the moment you leave.
The real investment here is in YOU.
Most clients spend between $1500-$2000

## google reviews (top 3)
- (5★ 2020-07) Kara is an amazing photographer with people skills that make her subjects extremely comfortable. I was nervous for a boudoir photo shoot, but by the end, we were both laughing through silly poses with amazing results. She has also photographed friend’s weddings and is able to blend into the scene flawlessly while getting crucial shots you WILL want. 100% recommend for any style photo shoots.
- (5★ 2022-05) I have gotten to work with Kara three times now and every time, she exceeds my amazement a million times over! But our Boho Chic Boudoir was one of my favorites! I was really nervous which was one of the reasons I loved having two friends there with me. Not only did we get to do a lot of cool shots together, but it also allowed for time to get comfortable and share different ideas. But the biggest
- (5★ 2022-12) Kara is an incredible photographer and person! I had been wanting to do a boudoir photo session for myself for awhile and after researching it, Kara seemed like the perfect fit and she was! I reached out to her to let her know why I was doing this (to honor my body for the journey it had been going through). Kara was kind and respectful about where I was at and what my needs were. She was professi

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-03.csv
