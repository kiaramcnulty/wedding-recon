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


=== PHOTOGRAPHER: Wildroot Collective - Colorado Elopement Planning | vendor_id=c5a905dc-653f-4f93-8bb3-676891947100 | bot=bot7 | date=11/2025 ===
# Wildroot Collective - Colorado Elopement Planning (Golden) — vendor_id=c5a905dc-653f-4f93-8bb3-676891947100
site=https://www.wildrootcollective.com/?utm_source=GMB&utm_medium=Website | google 5★ × 2 | SITE CRAWL FAILED (HTTP 409)

## site pricing/package lines
(none found on site)

## google reviews (top 2)
- (5★ 2022-04) Where do I even begin? We were so lucky to have Wildroot Collective photograph our elopement. They organically captured our huge smiles, happy tears, big love, and so much joy in every photo. It’s remarkable the way Ashley and Graham captured such beautiful, raw, human emotion - taking us back to that very moment, with each picture. Our wedding was at a mountain creek in Winter Park and it rained…
- (5★ 2022-04) Graham and Ashley were spectacular to work with for our elopement in Colorado. They were proactive and calm and walked us through each step of the process. They helped us pick a date and time (considering how crowded different places may be) and helped us find a location (even through multiple wildfires in the area at the time). It was obvious that they were very familiar with CO and had many diff

=== PHOTOGRAPHER: wmt.co | vendor_id=19a6b3c4-c72b-4315-bcaf-0cc3e3feee9e | bot=bot8 | date=10/2025 ===
# wmt.co (?) — vendor_id=19a6b3c4-c72b-4315-bcaf-0cc3e3feee9e
site=https://www.studiowmt.co/ | google 5★ × 44

## site pricing/package lines
How much should we invest?
We care about delivering quality work. It starts from meeting you in person, to shooting your wedding – ensuring the important moments are captured – and also looking through every single image that you receive. It should be one of the top three things you invest on for your wedding.

## google reviews (top 3)
- (5★ 2023-06) We’re really glad to have engaged Zakaria to capture the rawness of the emotions felt on our wedding. The portraits he took of us still remain my favourite photos till today and we display them in our house to remind us of our very special day. He also has this ability make everyone really comfortable and just be ourselves so the candid photos turned out really wonderful as well. Zack also has a r
- (5★ 2023-06) Zak has been amazing to work with. He has an eye for detail and has the ability to encapsulate every emotion into print. Through his photos I could relive my wedding all over again, marvelling at faces I saw briefly at my wedding but now forever captured in print. He takes the time to know you personally before shooting the wedding so it feels like having a friend over, instead of just a photograp
- (5★ 2023-06) We engaged Zak 8 years ago and till today we look back at our wedding photos and thot - wow those are good candid shots 🙂 love the quality of the print outs as well. And we like this custom made wooden box with the wooden usb key. Thot it was a cool gesture along with the photos. Overall Zak was flexible and fun to work with, Alhamdulillah.

=== PHOTOGRAPHER: Abby Shepard Photography | vendor_id=35d14415-cc66-467e-9756-35e5fa5e2b16 | bot=bot9 | date=4/2026 ===
# Abby Shepard Photography (Boulder) — vendor_id=35d14415-cc66-467e-9756-35e5fa5e2b16
site=https://abbyshepardphotography.com | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Abby Shepard Photography | Wedding and elopement photographer; bright, bold, natural images capturing real moments and genuine emotion | https://abbyshepardphotography.com

=== PHOTOGRAPHER: Alex Mabrey Photography | vendor_id=3b4d4a1d-c805-4a98-b998-817f095e8d28 | bot=bot10 | date=6/2025 ===
# Alex Mabrey Photography (Colorado Springs) — vendor_id=3b4d4a1d-c805-4a98-b998-817f095e8d28
site=https://alexmabrey.com | instagram=@alexmabrey | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Alex Mabrey Photography | Timeless editorial style | https://alexmabrey.com

=== PHOTOGRAPHER: Aly Cav Photography | vendor_id=85bcdf8d-517c-47c0-83f3-29eb2830549f | bot=bot11 | date=9/2025 ===
# Aly Cav Photography (?) — vendor_id=85bcdf8d-517c-47c0-83f3-29eb2830549f
site=https://alycav.com | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Aly Cav Photography | wedding rate starts at $3630 | alycav.com

=== PHOTOGRAPHER: Alyssa Carpenter Photography | vendor_id=0a66209b-7105-48d8-8a43-04eb4d2a8dfb | bot=bot12 | date=5/2026 ===
# Alyssa Carpenter Photography (?) — vendor_id=0a66209b-7105-48d8-8a43-04eb4d2a8dfb
site=https://alyssacarpenterphoto.com | instagram=@alyssacarpenterphoto | google ?★ × ?

## site pricing/package lines
More Details Here I’m a wedding and elopement photographer based in Longmont, Colorado, documenting couples who value genuine experiences over elaborate productions. I make sure your day feels like you, however unscripted it looks.
&laquo; Rocky Mountain Engagement Session
Colorado Wedding & Elopement Photographer | Alyssa Carpenter
Colorado Wedding & Elopement Photographer
Rocky Mountain Engagement Session
Tell Me More So, trust me when I say, I’ve been in your shoes, and I can help make it all come together with ease, no matter what happens! I’ve documented over 550 weddings and elopements in Colorado over the past decade, and I’m already all in with your story, too.
Colorado Wedding & Elopement Photography | Alyssa Carpenter
Colorado Wedding & Elopement Photography
Say Hey *Travel radius includes locations like Vail, Colorado Springs, RMNP, Fort Collins, etc. Planning something a little further away in Colorado (Crested Butte, Telluride, Durango, etc.) or beyond!? Please reach out below to inquire about more detailed travel fees.
**Boulder engagement sessions are $850
All adventure engagement session packages are 1.5 hours and include a 50% discount when booked with a wedding package, travel fees within 100 miles of Denver, CO*, two outfits, and an online gallery of high-resolution images with printing rights.
Adventure Engagement Sessions—$1,200**
All elopement packages are customizable and include at least 2 hours of coverage, travel fees within 100 miles of Denver, CO*, location planning, and an online gallery of high-resolution images with printing rights.

=== PHOTOGRAPHER: Amanda Podesta Photography | vendor_id=c24532ca-059b-415f-add9-f346bf918519 | bot=bot13 | date=3/2026 ===
# Amanda Podesta Photography (Aspen/Vail) — vendor_id=c24532ca-059b-415f-add9-f346bf918519
site=https://amandapodestaphotography.com | instagram=@amandapodestaphotography | google ?★ × ?

## site pricing/package lines
Micro Wedding + Elopement
Micro Wedding + Elopement Planning
Sounds like a Micro Wedding is going to be your best bet. A major advantage of having a micro wedding is it is so much easier than planning a full-on wedding. Similar to an elopement, pick the destination and day and we will work together to make your intimate soiree dreams a reality.
I have a whole network of vendors all around the United States, and internationally to make your dream elopement or micro wedding a reality.
Minimum Investment $2700
Elopement or Micro wedding Planning
I do not charge a travel fee within the contiguous United States.
International Destination travel fees vary by the destination.
We can begin with pricing. Your wedding day experience begins at $2600. I feel fairly confident I have created wedding offerings to fit just about every budget. We‘ll need to discuss your specific needs and we’ll be able to customize coverage that fits your day.
Is A Deposit Required ?
Yes, I require at least a 25% deposit at the time of booking . This deposit is non-refundable under most circumstances. The remainder is due one month prior to your wedding date.
What About Engagement Sessions?
A complimentary engagement or portrait session is included in most of my wedding packages. They are also available A La Carte. Engagement sessions can be held in pretty much any location depending on the time of year and distance.
Heck ya! Domestic Travel within the contiguous United States outside of Colorado is $800
International Travel is $2000

## region pricing digests
- [launchintel] Amanda Podesta Photography | Adventure lifestyle specialty | https://amandapodestaphotography.com

=== PHOTOGRAPHER: Amy Ronk Photography | vendor_id=8d58e1de-68e0-467f-97c3-45448ac1fb81 | bot=bot14 | date=3/2026 ===
# Amy Ronk Photography (Denver) — vendor_id=8d58e1de-68e0-467f-97c3-45448ac1fb81
site=https://www.amyronk.com | instagram=@amyronkphotography | google ?★ × ?

## site pricing/package lines
Please contact me for pricing/inquiries, or anything really-- lets go on all of the adventures together!

## region pricing digests
- [launchintel] Amy Ronk Photography | Fine art style; starts at $1,500-$2,300; weddings and elopements plus pet/family/lifestyle/branding/product/landscape; women-owned, LGBTQ+ friendly; studio at 3282 W Oxford Ave, Denver | https://www.amyronk.com

=== PHOTOGRAPHER: Angela Amen Photography | vendor_id=1a80a56f-6c14-45f1-88aa-ff2c5b03ae75 | bot=bot15 | date=5/2025 ===
# Angela Amen Photography (Denver/Westminster) — vendor_id=1a80a56f-6c14-45f1-88aa-ff2c5b03ae75
site=https://angelaamen.com | instagram=@angelaamenphotography | google ?★ × ?

## site pricing/package lines
My 6-hour package is perfect for smaller, intimate weddings and elopements. I’ll document the most meaningful parts of your day, and capture genuine moments, emotions, and connections as they naturally unfold to tell the story of your celebration.
Up to 6 hours of coverage
Second Shooter for 8 Hours
After the consultation I'll send a proposal. When you sign the proposal and pay the retainer, you're officially booked!
If the packages provided don't really fit what you're looking for, contact me with your needs and I'll create a custom package for you.
Can you create a custom package for our wedding?
How many hours of coverage do you recommend?
With one photographer I deliver at least 50-70 per hour.
With two photographers you can expect around 90-100 per hour.

## region pricing digests
- [launchintel] Angela Amen Photography | Photojournalistic style; documentary wedding photography and videography since 2018; packages start ~$1,800-$2,500, include 2 photographers, engagement session, print release, consultation; 4-6 week turnaround | https://angelaamen.com

=== PHOTOGRAPHER: Ashley Kristine Photo | vendor_id=a874165e-49b1-4a9a-b15c-8df26fbecb0e | bot=bot16 | date=8/2025 ===
# Ashley Kristine Photo (Windsor) — vendor_id=a874165e-49b1-4a9a-b15c-8df26fbecb0e
site=https://ashleykristinephoto.com | google ?★ × ?

## site pricing/package lines
Weddings and Elopements
Find the proposal package that fits you best! Whether you want basic coverage or a fancy hour-long affair with champagne and planning, i've got options for your style. And with 24-hour gallery turnaround, you'll have your memories fast. Let's make your perfect proposal moment, together!
From 15 minutes to an hour I offer packages for every type of session. Engagements, maternity, family, couples, announcements and more!
I offer base packages but every one can be customized for you.
Yes!! I will travel for $50 an hour of driving time when it is not included in the package.
Yes! It is the same pricing as my session pricing.
yes! I have an entire page for proposal pricing you can view above!
About Pricing Portfolio Contact
Wedding and Elopement Portfolio
Colorado Based Wedding & Elopement Photographer
I am a Wedding & Elopement photographer based out of Northern Colorado. I have shot over 180 weddings & elopements. I specialize in warm and colorful photography that I feel helps capture the fun and love in any moment. I am available anywhere adventure takes me!
Colorado & Washington bucket list locations can be booked with 25% off the listed package price. Travel bucket list locations can be booked for free if my travel is paid!!

## region pricing digests
- [launchintel] Ashley Kristine Photo | Classic style; starts at $3,200; wedding and elopement photography; Northern Colorado and Western Washington; 180+ weddings/elopements shot, warm/authentic/romantic storytelling style | https://ashleykristinephoto.com

=== PHOTOGRAPHER: Aspen Sage Photo | vendor_id=e2766aff-50a4-4ef0-b0a0-d2635717411d | bot=bot17 | date=8/2025 ===
# Aspen Sage Photo (Aspen) — vendor_id=e2766aff-50a4-4ef0-b0a0-d2635717411d
site=https://www.aspensagephoto.com | google ?★ × ?

## site pricing/package lines
A: Wedding, elopement, and portrait photography services are available to capture a variety of special moments.
Q: How can a package be customized?
A: Packages can be tailored to individual needs through a personalized consultation, Depending on hours needed or how many photographers wanted.
A: Once availability and budget are locked in (or as close as we can get). You will receive a contract and invoice for deposit. Deposits are usually 30% of the total cost. once everything is finalized you can sit back and relax.
A: Engagement sessions can often be included or added to packages for an additional fee.
General packaging | Enhance Your Event, Book Today &mdash; Aspen Sage Photo Colorado wedding Photographer
Portrait and wedding packages including Aspen CO, Glenwood Springs CO, Carbondale CO and surrounding areas
Pricing and Packages including Upstate New York and surrounding areas
After earning my photography degree from Colorado Mountain College in 2015, I took the reins on the business side of my photography career. With over 14 years of experience in elopement, event, journalism, and fashion photography.

## region pricing digests
- [launchintel] Aspen Sage Photo | Photojournalistic style; starts at $2,900; adventure and travel photography, 13+ years experience; serves Aspen, Carbondale, Glenwood Springs and all Colorado; elopements, portraits, full-day weddings; customizable packages | https://www.aspensagephoto.com

=== PHOTOGRAPHER: Autumn Parry Photography | vendor_id=21ea9652-bbe5-4ae9-8b78-f913e4b08cc8 | bot=bot1 | date=7/2025 ===
# Autumn Parry Photography (?) — vendor_id=21ea9652-bbe5-4ae9-8b78-f913e4b08cc8
site=https://autumnparryphotography.com | google ?★ × ?

## site pricing/package lines
We send you a hard copy of our photography planning guide, which includes our planning spreadsheet, tips on writing vows, timeline guidance, engagement session locations, vendor recommendations, and more &#8211; so you feel educated and supported throughout the planning process.
We go through thousands of photos to find the most meaningful moments from your day and edit in a true-to-life style so your photos stand the test of time. Through albums and prints, we create generational legacy so you can remember these moments long after your wedding.
All Packages Include
Handcrafted layflat albums
DOCUMENTARY-STYLE & ASSOCIATE COLLECTIONS
DOCUMENTARY STYLE WEDDING COLLECTIONS
Our documentary-style collections are captured by former photojournalists, Autumn and Griffin, who prioritize real moments, so you can be fully present for your wedding day experience. Collections can include our exclusive perks designed to add storytelling depth to your celebration.
PACKAGES CAN INCLUDE:
&#8211; Up to 12 hours of coverage
&#8211; Engagement session
&#8211; Wedding Albums + Prints
INQUIRE FOR ALL COLLECTIONS
Doc-Style Packages Include:
Our associate collections help us serve more couples, whether we’re already booked or to better fit your budget! When you book an associate collection, one of our amazing associates will capture your day and we handle all communication, planning, and post-wedding editing!
&#8211; Up to 10 hours of coverage
ASSOCIATE PACKAGES INCLUDE:
Celebrate this exciting chapter of your love story with a session designed to capture your unique connection. Our engagement photography packages focus on authentic moments, showcasing your personalities and the connection you share.

## region pricing digests
- [launchintel] Autumn Parry Photography | $6,400 starting per WPJA; adventure wedding photography specialist

=== PHOTOGRAPHER: Ayla Rae Weddings | vendor_id=dc2c6e93-fdf6-4bf0-a30a-0433cca63b87 | bot=bot2 | date=5/2026 ===
# Ayla Rae Weddings (?) — vendor_id=dc2c6e93-fdf6-4bf0-a30a-0433cca63b87
site=https://aylaraeweddings.com | google ?★ × ?

## site pricing/package lines
photo ranges between $6.8k-9.3k
photo & video ranges between $11-15.5k
front range weddings begin at $6k
All collections include
Full day coverage (9-12 hours)
Some collections include
Ayla exceeded every single expectation in both her presence and final collection of photos. I truly feel that she went above and beyond for us, and on the big day she felt like a welcome friend who encouraged and cheered us on wholeheartedly.“
Experience + Pricing
I thought, "This can't possibly be what a wedding is supposed to feel like," then promptly did a dramatic 180 and only photographed elopements for a few years.

=== PHOTOGRAPHER: Berg Berg Photography | vendor_id=02f90c4f-8880-4e0a-9516-ef3db9a3d7ea | bot=bot3 | date=9/2025 ===
# Berg Berg Photography (Golden) — vendor_id=02f90c4f-8880-4e0a-9516-ef3db9a3d7ea
site=https://www.bergbergphotography.com | google ?★ × ?

## site pricing/package lines
Golden Colorado Wedding Photographers | Wedding Packages &mdash; Berg Berg Photography
Pricing for any venue, packages named after mountains (Bergs)
Complimentary engagement session
Lookout Mountain $4250*
South Table Mountain $3250
Dinosaur Ridge $2000
3 hours of ELOPEMENT photography with Kevin or Michelle
Engagement, Family and Senior Portraits $800
Custom and Destination Packages also Available
Limited 35mm Film Photography starting at $300 Daylight hours during ceremony and couples portraits. Film is scanned and delivered digitally. Examples here.
Additional photography session with Kevin 1-2 hours $800 Sangeet, Mendhi, Barratt, rehearsal dinner, bachelor or bachelorette party, (may add additional hours at price below).
Extra Hour of Wedding Photography with Kevin and Michelle or second photographer $550
Engraved Wood USB Drive with all images and slideshow $50
Heirloom Fine Art Wedding Albums starting at $750
Travel fees included within 1 hour of Golden, CO. Additional time to be discussed per event.
To start, please set up a meeting with us, our calendar is online Let’s Meet! You may also contact us via text, email or a phone call to answer any questions you may have and see if we might be a good fit for you. During this discussion we will try to narrow down a package that fits your needs.
To book, we both sign the contract (online) and you pay the 40% retainer to lock your date in. Yea, one less thing to check off your “to do” list!
Do you charge travel fees?
We do not charge any travel fees within two hours of Golden, Colorado for weddings. More than two hours distance or for engagement or portrait sessions, there may be fees.

## region pricing digests
- [launchintel] Berg Berg Photography | $2,000 starting per WPJA; husband/wife team (Kevin Bergthold + Michelle Blomberg), 20 years experience, 300+ weddings; preferred photographer for Boettcher Mansion, Mt Vernon Canyon Club, Evergreen Lake House, Red Rocks, Golden Hotel | https://www.bergbergphotography.com

=== PHOTOGRAPHER: By The West | vendor_id=bbaa8742-43ab-49cc-9889-8e09b385cd6d | bot=bot4 | date=3/2025 ===
# By The West (Denver) — vendor_id=bbaa8742-43ab-49cc-9889-8e09b385cd6d
site=https://bythewest.co | google ?★ × ?

## site pricing/package lines
As an Aspen wedding photographer, I work with couples who value intentional, experience-driven celebrations. From alpine elopements to grand resort weekends, each story is crafted to reflect your pace, your people, and your environment.
By The West works with couples planning intentional, experience-driven weddings throughout the Vail Valley — from intimate mountain elopements to grand celebrations at Beaver Creek, Bachelor Gulch, and the surrounding alpine venues.
Our approach blends documentary storytelling with cinematic, editorial restraint, creating imagery that feels refined, timeless, and deeply personal. From intimate elopements to multi-day destination weddings, our focus is on capturing how your wedding felt, not just how it looked.
After our consultation, you&#8217;ll receive a custom quote along with a contract to review at your own pace. Once signed, a retainer officially reserves your date — from that point, your story is one we&#8217;re genuinely committed to telling.
The remaining balance is due two weeks prior to your event. Flexible payment installments are available for all packages. All balances must be paid in full before the wedding day.
$2,000 Retainer to Hold Your Date
Once everything is in place, we stay connected as your day approaches. Elopements tend to be more collaborative — thoughtful attention to location scouting, light timing, and the arc of the day. Full wedding days follow the structure already in place, with our role being to move quietly within it.

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-15.csv
