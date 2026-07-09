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


=== PHOTOGRAPHER: From the Hip Photo | vendor_id=acbe0507-f6cf-4e65-89a7-190d77137ee1 | bot=bot6 | date=5/2026 ===
# From the Hip Photo (Denver) — vendor_id=acbe0507-f6cf-4e65-89a7-190d77137ee1
site=https://fromthehipphoto.com/ | google 4.8★ × 119

## site pricing/package lines
Featured Mountain Engagement Session
Featured RiNo Engagement Session
Featured Downtown Engagement Session
Wedding Photography Packages
Straightforward pricing with everything included. No surprise fees, no per-image charges. Just great wedding photography.
+ Second Photographer
Highest Value Package
Two-photographer Hot Fudge Sundae package
One-hour engagement session included
Custom designed & printed wedding album
Full printing rights mean you can create albums, canvas prints, thank-you cards — anything you dream up. The images are yours forever, no extra licensing fees.
&#8220;We had a lead photographer and a second shooter for our big wedding at The Manor House. Having two photographers meant nothing was missed — they caught both of us getting ready simultaneously. The photos are stunning.&#8221;
Do you offer engagement sessions with wedding packages?
We do! Many couples add an engagement session to their wedding package. It&#8217;s a great way to get comfortable with your photographer before the big day, plus you&#8217;ll get amazing photos for save-the-dates and your wedding website. Ask us about bundled pricing when you book.
Do you offer albums or prints?
Weddings, elopements, and proposals across Colorado
Engagement sessions and proposal photography
Colorado Elopement Photography - From the Hip Photo
Colorado Elopement Photography
Travel time is included to all locations within one hour of our Denver studio, and we love adventuring further into the high country for couples who want something truly remote. Get in touch and let us help you plan the elopement of your dreams.

## google reviews (top 3)
- (5★ 2025-07) From the Hip knocked it out of the park for our wedding in June! Lauren was very responsive in the planning process and developing a package that met our needs. My husband doesn’t like having his photo taken and they were able to accommodate a smaller time package and still get incredible photos of us. Brooke was so sweet, captured beautiful moments of us, and understanding when we were ready to b
- (5★ 2021-01) We booked with From the Hip for both our maternity and newborn photos and are very happy we did! Lauren is very professional and responsive during the planning phase and Julia did a wonderful job on our photos. They were both very kind and flexible when we had to reschedule day of due to unexpected scheduling issues on our end. Then the day of, we had to change locations at the last minute due to 
- (5★ 2023-08) From The Hip ... how can I put into words how incredible this team was?! They not only shot our incredible surprise engagement pictures, but we went with them for our big day and they did not disappoint. We got all of our pictures back at the 30 day mark as promised and they are beyond anything I could have ever asked for. I haven't stopped scrolling through the thousands of pictures and feel so b

=== PHOTOGRAPHER: Gary Soles Gallery | vendor_id=df033225-35c2-4a43-96dc-c202badaf66a | bot=bot7 | date=6/2026 ===
# Gary Soles Gallery (Breckenridge) — vendor_id=df033225-35c2-4a43-96dc-c202badaf66a
site=https://www.breckenridgephotoshop.com/ | google 5★ × 33

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2023-08) Let me start by saying that I am no art connoisseur, but I knows what I likes. There is no shortage of photo galleries in Breck, but Gary's work has always resonated with us. We make a point to go by the shop every time we go to Breckenridge. We have been fortunate enough to be able to acquire several pieces over the years and they always get compliments. On top of it, Gary is a super nice dude!
- (5★ 2025-09) I’ve bought several (beautiful) images (beautifully framed!) from Gary over the years. Most recently we had a shipping snafu from Breckenridge to Texas and Gary went above and beyond to make it right. Gary isn’t just a pro photographer he’s a stand-up guy and we will happily have his work all over our walls for decades to come!
- (5★ 2022-03) Inspiring Photography. Amazing Customer Service. We always stop by Garys shop when walking Main Street with out of town guests. Super Friendly, informative, new work, and willing to keep his doors open in the evening. Smaller prints of his large scale work have been great gifts and easy for our guests to pack.

=== PHOTOGRAPHER: GIGI•C Weddings | vendor_id=878dad24-7ff2-493b-8b97-9fe4b6511c90 | bot=bot8 | date=6/2025 ===
# GIGI•C Weddings (Telluride) — vendor_id=878dad24-7ff2-493b-8b97-9fe4b6511c90
site=http://www.weddingsbygigi.com/ | google 5★ × 33

## site pricing/package lines
Our design package is perfect for couples planning their own wedding who may be struggling to conceptualize their vision. With our comprehensive design decks and tailored vendor suggestions, we will help you create a gorgeous and unforgettable event! Let us bring your dream wedding to life
Angela did an AMAZING job making our day perfect. She was easy to communicate with and very competent on the vendors and pricing in the area.
With our full service planning package, your only worry will be when to pop the next bottle of bubbles. Sit back and relax- we’ll take it from here!
Gigi C's most inclusive and popular package
Isn't it time to create the fairytale wedding you've always wanted? When you book this package, you'll start planning with Gigi(Angela) right away! Let's embark on this exciting journey together!

## google reviews (top 3)
- (5★ 2021-10) Our wedding would not have been possible without Mary Ellen and Simplify. Thanks to her expert guidance, tireless work ethic and creative talents, our wedding was more beautiful and fun than we could have hoped for. She handled everything with poise, professionalism, and a confidence that was contagious. We will forever be grateful to her for allowing us to enjoy our weekend and cherish time with 
- (5★ 2025-01) I can’t recommend Angela and the Simplify Telluride team enough. When my now husband and I got engaged we didn’t really know what we wanted. We just knew *where we wanted to get married. It took just one email and a zoom for us to connect with Angela. I mean, connect connect. She just got us. Our story. Our sense of adventure. Our love. She took all of that and helped us find vendors and craft det
- (5★ 2025-01) Angela with Simplify Telluride did an AMAZING job making our day perfect. She was easy to communicate with and very competent on the vendors and pricing in the area. We are from Wisconsin so being able to trust our planner while planning an out of state wedding was so important to us. We didn’t have to worry about a single thing on the actual day of the wedding and we were given tons of recommenda

=== PHOTOGRAPHER: Gillespie Photography | vendor_id=d095542b-99d4-47d4-9294-484786639d65 | bot=bot9 | date=4/2025 ===
# Gillespie Photography (Silverthorne) — vendor_id=d095542b-99d4-47d4-9294-484786639d65
site=https://www.gillphotos.com/ | google 4.9★ × 51

## site pricing/package lines
their work is some of the finest we have ever seen. Our engagement session in Rocky Mountain National Park

## google reviews (top 3)
- (5★ 2025-12) Working with Gillespie Photography was an extraordinary privilege. They are unbelievably creative and worked tirelessly — not only throughout the wedding weekend, but for months beforehand — to understand the narrative of our celebration and capture it with intention and artistry. The photographs they created for us do not simply document a wedding; they tell the full, emotional story of our weeke
- (5★ 2024-06) We are so glad we hired Trent to photograph our wedding! He went above and beyond in multiple ways for us. We had a lot of plans change at the last second due to weather. Trent was able to shoot a ski lap with all our family and friends the day before, not only being there early but also coordinated and lead the entire thing at the last minute! The day of the wedding he also kept everything runnin
- (5★ 2026-05) I wish I could rate Trent more than 5 stars, because he's absolutely one of the finest wedding professionals I have ever worked with. The photographer for my client's wedding broke his hand one week before the wedding, and Trent stepped in to cover it. He drove 4 hours to be in Moab, shot the couple and the wedding all day, and then stayed to help my crew clean up the site at the end of the night,

## region pricing digests
- [launchintel] Gillespie Photography | $6,200 starting per WPJA; husband/wife team (Stacy + Trent Gillespie); documentary-style wedding/elopement; serves Breckenridge, Telluride, Vail and all CO wedding venues; destination weddings worldwide | https://www.gillphotos.com

=== PHOTOGRAPHER: Glitter & Bliss Wedding Planning & Events | vendor_id=4954f761-b2c3-4c4d-884e-065a70f8d163 | bot=bot10 | date=1/2026 ===
# Glitter & Bliss Wedding Planning & Events (Vail) — vendor_id=4954f761-b2c3-4c4d-884e-065a70f8d163
site=http://www.glitterandblissweddings.com/ | google 5★ × 58

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-11) We got married this year in Vail, and Sylwia was absolutely incredible! Our wedding was a big production. We had lots of moving parts, locations, and details to manage. We moved all around Vail, from the bottom to the top, and back down again. Luckily Sylwia is an absolute pro and easily helped weave everything together for us. She was fully on board with our vision and helped take the pressure of
- (4★ 2026-03) Sylwia was our wedding coordinator, and she did an amazing job keeping everything organized and running smoothly. She handled a lot of the planning, logistics, and day of coordination, and she even stayed to help with cleanup at the end of the night which was a huge help. We had around 150 guests, and in hindsight it would have been ideal to have an additional assistant to support her (either as a
- (5★ 2025-10) Working with Sylwia for our wedding planning was absolutely fantastic! The entire process was so seamless - she was there to answer any questions, give guidance and amazing recommendations, and was truly a delight to work with. Her timeline and planning was absolutely perfect. We did not have to worry about a single thing on our wedding day because she had handled everything. Her attention to all

=== PHOTOGRAPHER: Gretchen Troop Photography | vendor_id=5a60252c-683a-449e-8332-4663ec84937c | bot=bot11 | date=3/2025 ===
# Gretchen Troop Photography (Boulder) — vendor_id=5a60252c-683a-449e-8332-4663ec84937c
site=https://boulderweddingphoto.com/ | instagram=@gtroopphoto | google 5★ × 38

## site pricing/package lines
When do you need a second photographer? In general, adding another photographer allows you to have photographers in two places at one time, and to get two angles and perspectives throughout the day....
One of a kind locations, fun and photos Gretchen Troop Photography offers destination engagement photography adventures for $800 a la carte. With any wedding package you book there is a discount for...
I cannot rate Gretchen and her team high enough. They made our amazing day unforgettable!
We hired Gretchen for our engagement shoot and wedding. based on reviews and pricing, she was easily the best bang for our buck. Working with her was a breeze. She was very professional yet fun, and not afraid to take charge of the situation on wedding day on our behalf.
Brandi & Michael got my top package, Quaking Aspen, including 2 photographers, 2 videographers and an assistant/content creator for their wedding day Sunday, June 28th. The team was phenomenal! Shout out to, @chris_james_films, @alightphotog, @kristenrushphotography & @grahamofthegram⁠
It finally happened!!! I have been entering the Fearless Photographer Awards since 2019 and have never won. It is exceedingly hard to win, which makes this all the sweeter. This photo is now part of Collection 92. I am one of only 15 Americans in the collection to have won.⁠
Pricing for Wedding Photography and Video
Wedding photography is more than just an expense—it’s an investment in memories that will be cherished for generations.
Here are some outlines of my package pricing. After we talk I will give you a full quote on the phone, as well as send out a custom package proposal.

## google reviews (top 3)
- (5★ 2021-10) Gretchen is so incredibly talented!! Her skills with lighting, color, and framing are just breathtaking. She included engagement photos with our wedding photo package, and did an amazing job with both. She has a great familiarity with Rocky Mountain locations, and took us to some stunning spots to take photos. She is full of creative energy and ideas, and not afraid to hike through anything (even 
- (5★ 2026-01) Gretchen is beyond exceptional at her work. Each photo captures the emotion of our wedding, showcasing all of the love that was shared. Her attention to lighting, details, and creativity sets her apart from so many other photographers. Working with Gretchen was effortless, and she made the entire experience perfect. Her joy for the craft, professionalism, and humor made our wedding amazing. She we
- (5★ 2022-10) Gretchen did AMAZING job as our photographer! We are from Texas and had no idea what our elopement day would look like but she gave us the run-through a week before and we couldn't be happier with our wedding day. We spend a whole evening at Rocky Mountain NP and her knowledge around the park and as an experienced photographer made our wedding so much more meaningful. We have received so many comp

## region pricing digests
- [launchintel] Gretchen Troop Photography | $3,700-$7,300 photo only, $8,000-$17,300 with video; mountain weddings, Estes Park focus; wedding/elopement/engagement; shooting since 2012 | https://boulderweddingphoto.com

=== PHOTOGRAPHER: Grumpyhighlander | vendor_id=128ae87d-affa-4f71-a9f5-81cb8f7cd5a5 | bot=bot12 | date=4/2025 ===
# Grumpyhighlander (Durango) — vendor_id=128ae87d-affa-4f71-a9f5-81cb8f7cd5a5
site=https://www.grumpyhighlander.com/ | google 5★ × 2

## site pricing/package lines
Services and Pricing 2023
Home CLASSES, EVENTS and TUTORING Services and Pricing 2023 favorite Landscapes of 2020 Durango Dog Ranch Real Estate Services
Packages &mdash; Grumpyhighlander
Services and Pricing 2023 &mdash; Grumpyhighlander
Services and Pricing
Rates for General work in 2026
Headshots, Indoor or outdoor we provide headshots for area professionals, the session will last around one hour not including editing time done afterwards. $550.00 for the session and edits, this will produce 15 to 20 finished images
Senior Photos, Looking for a different high school yearbook picture, we have taken many senior photos and would be happy to work with you on your project and ideas, Pricing starts at $500.00 for a basic session and we are energized to provide an entire shoot for the whole yearbook collage.
HIgh altitude Wedding in the San Juan Mountains at 12,00ft. A quiet private event. this can be done at the event rate as it was not a full wedding event.
Headshots and Group Pricing For 2026

## google reviews (top 2)
- (5★ 2023-01) Took a bunch of pictures for us at the Durango Dog Ranch, it was a proposal and he took a ton of great pictures! He definitely knows what he's doing!
- (5★ 2026-02) Captures big and little moments just perfectly without any intrusion. Excellent work!

=== PHOTOGRAPHER: Hannah Collier Photography | vendor_id=358dbe5c-91ab-4b1f-93b4-c887490a13ee | bot=bot13 | date=7/2025 ===
# Hannah Collier Photography (Colorado Springs) — vendor_id=358dbe5c-91ab-4b1f-93b4-c887490a13ee
site=http://www.hannahcollier.com/ | google 5★ × 34

## site pricing/package lines
Colorado Family, Elopement & Wedding Photographer
Every event is VERY unique, and the pricing is unique for each event. Our units are clean, professionally maintained and ready to roll!
Please contact us for YOUR unique pricing quote...we will work with you to make your budget work!
INVEST | Hannah Collier
I want to give you a complete custom experience so that you get everything out of your wedding day. Let's jump on a video call or meet up in person so that we can go over exactly what you want and find a collection that is perfect for you!
INVESTMENT starts at:
Contact me about a proposal or engagement session!
Complete elopement planning
Adventure Elopements/Micro-Weddings
I CAN HELP! I ALSO SPECIALIZE IN CORPORATE EVENTS, MATERNITY, BRANDING, PROPOSALS AND ELOPEMENTS!

## google reviews (top 3)
- (5★ 2024-08) Hannah is a genius behind the camera and is the friendliest professional you never knew you needed. We decided to travel to Colorado for our wedding and she made sure everything was perfect and handled the craziness of the day. Always on time, approachable and made sure all special moments were captured. Having these memories to look back on is such a treasure. Look no further if you are wanting t
- (5★ 2022-11) Hannah took our wedding photos and WOW!!! She did amazing work! Not only are they emotionally capturing the most important day, but the lighting and colors turned out perfect. She is so friendly and kind and so is Blake! He was really helpful and amazing all day!
- (5★ 2022-04) Save yourself some trouble and just have Hannah take your photos. Hannah has taken our family photos for 5 or 6 years now, and I could tell you she's a pro, she's easy to work with, she's personable- and that would all be true. But at the end of the day, you should probably hire Hannah because she captures the moment -- and makes us all look good at the same time. If you want to look back on your

=== PHOTOGRAPHER: Hannah Henke Photography | vendor_id=485d7852-95bc-4d04-8884-123c9eae520e | bot=bot14 | date=9/2025 ===
# Hannah Henke Photography (Denver) — vendor_id=485d7852-95bc-4d04-8884-123c9eae520e
site=https://hannahhenke.com/ | google 5★ × 35

## site pricing/package lines
About Home blog Travel investment contact me Colorado
Wedding Photographers Denver - Investment
Every Collection Includes:
Most of my couples invest around $8,000 for full wedding day coverage.
Collections are designed to be flexible and tailored to your celebration, from intimate gatherings to full wedding weekends.
Custom pricing is also available for micro weddings, elopements, engagement sessions, and multi-day celebrations.

## google reviews (top 3)
- (5★ 2025-12) Hannah is absolutely amazing. We HIGHLY recommend choosing her to photograph your special moments! We first met Hannah at our friends' wedding, where she was photographing their big day. We already knew she was an amazing photographer from seeing their engagement photos but when we met her we knew right away from the kindness and coolness that she exuded that we would love to work with her if we e
- (5★ 2023-12) Hannah Henke is an absolute gem of a human being and a beautiful photographer. My husbands and I's wish was to have less posed moments, less pictures of solely us the couple, and more moments captured of our people living and celebrating our day. And boy did Hannah capture precious memories and emotions of our day. On the professional side of things, from the moment I inquired with her, she was su
- (5★ 2026-02) Hannah is our girl! We couldn't have asked for a better documentarian of our day. We felt passionate about preparing for the day but then letting it play out and Hannah was there the whole time to get the timeless shots we needed to pass down to the grandkids as well as the in-the-moment shots that we cherish the most. Hannah will help you feel at ease about your own wedding day which is such an u

=== PHOTOGRAPHER: Hannah Morvay Photography | vendor_id=b91f09aa-1cc8-455c-9b61-76d99b3d606c | bot=bot15 | date=2/2025 ===
# Hannah Morvay Photography (Golden) — vendor_id=b91f09aa-1cc8-455c-9b61-76d99b3d606c
site=http://hannahmorvayphoto.squarespace.com/ | google 5★ × 19

## site pricing/package lines
Lifestyle portraits, weddings, elopements, and adventure photography
Wedding prices start at $400/ hr
Lets chat and plan out the perfect package for you!
Elopements &mdash; Hannah Morvay Photography
I love love. Want an adventure engagement session on the top of a mountain? A intimate session close by? Let me help you tell the world your love story!

## google reviews (top 3)
- (5★ 2022-11) Hannah photographed our wedding ceremony at the Jeffco courthouse. Hannah is amazing to work with and we are so happy with the pictures!! She made us feel very comfortable and we had so much fun when we did our couples shots at Red Rocks. Highly recommend!!
- (5★ 2020-07) Hannah is amazing! She shot my surprise engagement and she did a family photo shoot for us with our dogs (including a young puppy). She is professional and does an amazing job keeping you comfortable and allowing the moments to be intimate. You barely even know she's there! She is patient with both humans and dogs, and can see the shot before you even sit where she asks you to. Hannah's editing is
- (5★ 2022-08) I can’t say enough good things about Hannah. We we’re screwed over by our previous maternity photographer and Hannah offered to do a complimentary mini session to make up for someone else. However, our little baby decided to make her appearance 5 weeks early and before the session. A week after we got home Hannah came to our house and took the most amazing moment. These photos will be cherished fo

=== PHOTOGRAPHER: Heather Jackson Photography | vendor_id=909b13b0-da75-4c9c-99a8-62841b149c73 | bot=bot16 | date=1/2026 ===
# Heather Jackson Photography (Salida) — vendor_id=909b13b0-da75-4c9c-99a8-62841b149c73
site=https://jacksontakesphotos.com/ | instagram=@heatherjacksonphotography | google 5★ × 111

## site pricing/package lines
Colorado Elopement & Couple Photography Pricing - Photo Session Package
PHOTOGRAPHY PACKAGES FOR EVERYONE
Colorado Wedding &#038; Couples Photography Pricing
ELOPEMENTS / MICROWEDDINGS
ADDITIONAL HOURS $600/PER
KEEP IT SIMPLE PACKAGE
ASSISTANT SECOND PHOTOGRAPHER
ADVENTURE ENGAGEMENT SESSION
SUPER 8MM FILM PACKAGES
WEDDING DAY (6+ MIN FILM) $2,500
ELOPEMENT (6+ MIN FILM) $2,500
ENGAGEMENT SESSION (3 MINUTES) $800
WEDDING &#038; ELOPEMENT PACKAGES
Which package is right for me?
&#8211; Weddings over 50 people I suggest the Party Hard Package
&#8211; Weddings under 30 people I suggest the Keep It Simple Package
&#8211; Intimate weddings with less than 20 people, I suggest the Elopement Package with custom a la carte additional hours added to fit your timeline
&#8211; Elopements with just the couple, the Elopement package is a great start, and we can always add hours of coverage if needed
&#8211; Elopements 150+ high resolution images
&#8211; Nope. All my travel fees come out of the package price. If you have a wedding outside the state of Colorado I suggest the Party Hard for the western USA, or the Whole Freakin Weekend Package for eastern USA, Canada &#038; Mexico. For Europe or South America I suggest the Worldwide Package.
May I schedule an engagement session also?
&#8211; All galleries are delivered in color, with some images in black and white at my artistic discretion (average 10% of the gallery). You may add a full black and white gallery to any package for $600.
&#8211; Yes, after you sign a release agreement and pay the Raw Image Release Fee. The Raw Image Release Fee is $2000. Once the release is signed and fee is paid, I will load all of your RAW files onto a quality external disk and insured mail it to you.

## google reviews (top 3)
- (5★ 2023-10) If I could give Heather 1000 stars I would! We first heard about Heather from a friend of a friend who gave her a glowing review after she took their wedding photos and when my husband and I finally started to plan our small wedding/elopement and look for photographers, we decided to check her out. Knowing a photographer is a big expense we looked at other reviews, looked around and then decided o
- (5★ 2025-06) I cannot express enough good things about Heather. We found her because she had done pictures for a friends previous wedding and we were not disappointed. She’s an absolute BADASS at what she does and creates true art. She handled difficult family members and wedding guests like a champ, pushed to have exactly what we imagined and captured our day that quite literally made me cry reimagining our d
- (5★ 2023-11) Heather is an absolute dream! She will be your teammate and champion through the whole wedding planning process and especially on the wedding day. We were drawn to Heather’s work because we could tell how much joy, energy and fun that she brought to the couples she worked with. We love that the photos of our wedding capture the emotions of the day so completely. We had never had professional photo

## region pricing digests
- [launchintel] Heather Jackson Photography | Timeless editorial style | https://jacksontakesphotos.com

=== PHOTOGRAPHER: HoneyLensPhoto Colorado | vendor_id=86f43d07-28ab-43e0-b92c-0beb86af962f | bot=bot17 | date=2/2025 ===
# HoneyLensPhoto Colorado (Conifer) — vendor_id=86f43d07-28ab-43e0-b92c-0beb86af962f
site=http://honeylensphotocolorado.com/ | google 5★ × 123

## site pricing/package lines
Denver Wedding & Elopement Photographer | HoneyLensPhoto
ABOUT PORTFOLIO INVESTMENT CONTACT
Denver Micro-Wedding and Elopement Photography
Capturing micro-weddings and elopements in Denver + throughout Colorado
One-of-a-kind photography to capture your one-of-a-kind love story . Capturing micro-weddings and elopements in Denver + throughout Colorado
→ An intentional celebration of your love - from who you invite to the nature surrounding you, you decided to have a micro-wedding or elopement so you could focus on what matters most to you.
Three full hours of coverage for your special event
Investment: $1,350.00
1 hour of coverage: $600.00
2 hours of coverage: $975.00
Micro-Wedding and Elopement Photography
Travel fees apply outside of the Denver foothills
View Micro-Wedding and Elopement Photography Portfolio
Micro- Wedding and Elopement Photography Portfolio
Do you require a retainer?
Is the retainer refundable?
Please allow four weeks to receive your images for elopements and celebrations. Social media sneak peeks are usually available within 72 hours.
Yes. Upon booking, I require a 50% retainer to reserve your day and time. This is applied toward your final balance. The final balance is due on the day of your celebration.
YES! The studio has a paid subscription available to you for interactive wardrobe selection. I can also facilitate dress rentals for engagement sessions or special celebrations.
Micro Weddings + Elopements - Family Lifestyle - Senior Portraits
Investment | HoneyLensPhoto
Micro-Weddings & Elopements

## google reviews (top 3)
- (5★ 2026-05) Lisa came highly recommended to us, and after working with her for our engagement photos, we can absolutely see why! We loved our experience so much that we already have her booked for our wedding. She helped us pick out what to wear, listened to the style and shots we wanted from our Pinterest board, and truly brought our vision to life. She made the entire process so fun and comfortable! Lisa is
- (5★ 2026-04) LisaAnn was our photographer for our wedding day. Before our wedding, she spent time with me helping to plan and organize our day. On our wedding day, she was exactly who we needed to help coordinate photos and our group. We already knew we would get beautiful pictures (have you seen her instagram😁), but her help was priceless in making our special day go smoothly. She got our sneak peeks to us s
- (5★ 2026-06) We had our wedding in Conifer, Colorado and HoneyLensPhoto were so nice and helped us feel comfortable and confident taking our pictures! We also took amazing first look pictures at Staunton Park! They truly made our micro wedding special and we will treasure these pictures forever! Our family really appreciate you and all of the work you did for us!

=== PHOTOGRAPHER: Iva Dostal Photography | vendor_id=3ebe6729-6f8a-4e31-8ae5-77da6097f0ae | bot=bot1 | date=7/2025 ===
# Iva Dostal Photography (Longmont) — vendor_id=3ebe6729-6f8a-4e31-8ae5-77da6097f0ae
site=http://www.ivadostalphotography.com/ | google 5★ × 35

## site pricing/package lines
Colorado Wedding Photography | Iva Dostal Photography | Pricing
If you are getting married and are interested in wedding photography services just head over to the Inquiry form. We can schedule a chat to create a customized photography package that will be the perfect fit for your wedding day.
Starts at $2,000 for 4 hours and can go up to 12 hours
Travel fees are included within Front Range Colorado, Winter Park, Dillon and surrounding areas
Handcrafted 20 page album $850
Second photographer $80 per hour (4 hours minimum)

## google reviews (top 3)
- (5★ 2021-07) Iva Dostal is hands down the most amazing wedding photographer. When I got engaged, the first thing I did was begin the search for someone who could truly capture the beauty and authenticity of our wedding day. I also wanted someone who is structured and organized. Iva was the PERFECT find. She met with us 2 times before the wedding and created an easy to follow timeline. She walked us through pos
- (5★ 2018-07) Iva photographed our wedding and was so incredibly wonderful to work with from beginning to end. She created a fun atmosphere for taking pictures and was very personable and easy to work with. She surveyed the venue prior to the wedding day to get a feel for the venue and where the best shots could take place. Her attention to detail is evident in her work. We could not be more pleased with her be
- (5★ 2019-10) Iva was amazing - hire her for your wedding! You won't regret it. She has a fantastic eye and the quality of her photos is excellent. We are so thrilled with the variety and quantity of photos we have, and everyone we've shown them to has gasped at their beauty (literally). Iva was great to work with, her communication was on point, and we really enjoyed her presence on the day of our wedding. We

=== PHOTOGRAPHER: Jacey Kate Photography | Crested Butte, Colorado Wedding + Elopement Photographer | vendor_id=7a843d9d-ee74-4270-8ee5-8029303b3db0 | bot=bot2 | date=11/2025 ===
# Jacey Kate Photography | Crested Butte, Colorado Wedding + Elopement Photographer (Crested Butte) — vendor_id=7a843d9d-ee74-4270-8ee5-8029303b3db0
site=http://jaceykatephoto.com/ | google 5★ × 67

## site pricing/package lines
Weddings | Crested Butte, Colorado Wedding + Elopement Photographer | Jacey Kate Photography
My goal in capturing your wedding is to create images that encompass what makes you two, uniquely you! Take a peek at my documentary style of wedding photography below, and see full albums in my client albums page.
Weddings Starting at $5,000
*Inquire for packages
Crested Butte, Colorado Wedding + Elopement Photographer | Jacey Kate Photography
Wedding + Elopement Photographer
Let's make your dreams come true by capturing your Wedding or Elopement in the wildflower capital of Crested Butte, Colorado!
I am interested in another one of your sessions or packages
About | Crested Butte, Colorado Wedding + Elopement Photographer | Jacey Kate Photography
Elopements | Crested Butte, Colorado Wedding + Elopement Photographer | Jacey Kate Photography
Elopements Starting at $3,000

## google reviews (top 3)
- (5★ 2025-12) We worked with Jacey to photograph our elopement in Crested Butte and strongly recommend her work. When we first reached out, she was responsive but wasn’t overly pushy. And once we decided to work with her, she was flexible and accommodating. Crested Butte is a beautiful place and weighing the options for an elopement location was a little daunting for us; however, Jacey did a wonderful job worki
- (5★ 2026-01) I am literally OBSESSED with all of the photos Jacey took of us! She helped us plan the perfect photoshoot itinerary, and every location she suggested was absolutely magical. I was nervous about looking awkward in photos, but Jacey made me feel so relaxed and gave gentle guidance and small adjustments that made everything look so natural and beautiful. Jacey truly made my elopement dreams come tru
- (5★ 2026-03) The photos speak for themselves! Not only is Jacey a talented photographer but she is just a joy to be around. She is down for anything or any adventure to make sure you get the photos you dream of. You can tell photography is her passion and she has fun doing it which makes you feel so comfortable around her and in front of the camera. She is great with couple shoots, as well as group and candid

=== PHOTOGRAPHER: Jacie Marguerite Fine Art Photographer | vendor_id=cc2a042d-2634-4a28-9097-71cca89024f0 | bot=bot3 | date=10/2025 ===
# Jacie Marguerite Fine Art Photographer (Aspen) — vendor_id=cc2a042d-2634-4a28-9097-71cca89024f0
site=https://www.jaciemarguerite.com/ | google 5★ × 48

## site pricing/package lines
A curated collection of weddings defined by emotion, elegance, and a sense of nostalgia—captured with intention across Aspen, California, New York, Europe, and beyond

## google reviews (top 3)
- (5★ 2025-02) We had the absolute best experience with Jacie as our wedding photographer! From our engagement session to our entire wedding weekend, she went above and beyond to capture the most beautiful and meaningful moments. Her creativity, professionalism, and attention to detail made us feel so at ease, and the results were nothing short of stunning. Jacie truly cares about her clients—not just as custome
- (5★ 2019-08) Jacie is such an incredible photographer and so much more. She is great at giving directions even to people who have never been photographed before. She captures the cute little moments that people dream about! We had an engagement photoshoot with her and couldn't be happier with the outcome. She has a beautiful editing style as well that is to DIE for! We can't wait to have her photograph our wed
- (5★ 2023-02) Jacie captured both our engagement and wedding photos and I'd be lying if I said each photograph isn't one of the most stunning things I've ever seen! Jacie did a fabulous job of capturing all of the moments on our wedding day, big and small, and keeping things fun while doing it. She's truly a joy to be around and makes you feel comfortable right from the start! Your wedding photos are one of the

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-07.csv
