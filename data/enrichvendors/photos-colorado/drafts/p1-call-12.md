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


=== PHOTOGRAPHER: Sarah Christine Photography | vendor_id=9c571b43-daba-4865-aa10-7c747a4dee19 | bot=bot13 | date=5/2025 ===
# Sarah Christine Photography (Fort Collins) — vendor_id=9c571b43-daba-4865-aa10-7c747a4dee19
site=http://www.sarahchristinephotography.com/ | google 5★ × 55

## site pricing/package lines
our style, pricing & process
Elopement Information
vIDEOGRAPHY Packages
You want to book! Let me know, tell me what package and Ill send you a contract and ways to send in your retainer ! and then I am ALL yours
Depending on your package we may do engagement session and we will plot and plan where to go, I have a few client dresses and style guide that can help. I also have MANY MANY SPOTS we can go to all over to get the perfect spot
book your date & pay deposit
&lt; Back to all Packages
Engagement Photo Album 8x8
journal inquire Investment galleries about home
I do Weddings, Families, Babies, Senior Photos, Elopements and Boudoir- where ever life starts for you.
I hired Sarah to do photos for my elopement in Colorado.
Prices Family : $250 (mini's) to $700 for extend families
Prices Senior : $500
Prices Elopements : $500 an hour
Prices Weddings : $3000-$6000
Prices Flying Dress : $450
Prices Headshots : $350 (mini's) and up

## google reviews (top 3)
- (5★ 2024-05) Sarah was our phenomenal photographer for our one of a kind wedding!!! She is splendidly professional, has an exquisite eye & talent to say the least, loaded with joy. She knew just what to say to capture the absolute best guided candid photos. She was nonstop movement. Continuous clever jokes to keep the smiles & laughter flowing. Our venue is a historical house so naturally there will be unique 
- (5★ 2022-07) I would look no further because this is the best photographer by far! Sarah was astounding! Her prices are extremely reasonable, she is willing to go the extra mile to making sure everyone is satisfied and happy, and she will help in anyway she can on your special day. I got the silver package that included our engagement session photos which me and my husband are extremely happy with how they tur
- (5★ 2023-12) My family has used Sarah for family pictures and also for my son’s senior pictures. I am currently planning my wedding, so without hesitation, I reached out to Sarah once again. I love her whimsical style and creative eye. As an artist myself, I’m very particular and recognize good art when I see it. Initially, we were only planning to have Sarah take pictures at the wedding, but she convinced us

=== PHOTOGRAPHER: Sarah Goff Photography | vendor_id=4f27cf98-6fd4-481f-9ea3-4f19595074fa | bot=bot14 | date=5/2025 ===
# Sarah Goff Photography (Berthoud) — vendor_id=4f27cf98-6fd4-481f-9ea3-4f19595074fa
site=http://www.sarahgoffphotography.com/ | google 5★ × 29

## site pricing/package lines
EXPERIENCE & PRICING
An Intimate Elopement in Rocky Mountain National Park &#8211; Moose Crashes Elopement
Wedding Photography Pricing - Sarah Goff Photography
Distinctly Radiant Wedding Packages for Your Unique Celebration
Engagement Session Pricing &gt;
When you choose Sarah Goff Photography, you're not just hiring a photographer - you're investing in a team dedicated to making your wedding day extraordinary
ALL COLORADO WEDDING PHOTOGRAPHY PACKAGES INCLUDE:
Book with confidence! Invest in professional creativity and attention to detail so that you love your photos.
NO TRAVEL FEES IN COLORADO
Whether you choose a mountaintop overlook or an urban rooftop, there are no travel fees within the state for weddings of 6 or more hours.
Colorado Wedding Photography Packages Start at
Most couples invest $6800
Package options include:
GET INSTANT ACCESS TO PRICING
We&#8217;ll take care of the easy booking details with an online contract and 50% retainer to save your date.
Let&#8217;s discuss the best season and perfect location for an engagement session. We&#8217;ll get a date on the calendar and get excited for your photo session!
Ask about my Preferred Venue Pricing!
Packages start at $3000
REQUEST PRICING AND AVAILABILITY &gt;

## google reviews (top 3)
- (5★ 2024-08) Sarah Goff Photography is a MUST Book!!! Sarah was the greatest photographer to work with! We were initially drawn to her photography because of the vibrancy of her photos and because we could tell how organized and professional she was from our first video meeting! It was really important to us that we personally liked the vendors that we picked, and we felt like we were in great hands with Sarah
- (5★ 2024-01) I had the pleasure of working with Sarah and her team for my wedding, and I couldn't be happier with the entire experience. From the beginning, she demonstrated exceptional organization by understanding the shots that were important to me and making sure to capture the important events of the night. Not only was she punctual, adhering to the timeline seamlessly, but her direction during poses show
- (5★ 2017-12) My husband and I are beyond thankful we found Sarah to be our wedding photographer! She is a joy to work with and truly "captured us" in all of our engagement and wedding photos. Very easy to communicate with and we were super impressed with her quick turnaround times for delivering photos for both our engagement and wedding. We knew we chose an amazing photographer when we received her personaliz

=== PHOTOGRAPHER: Sarah Roshan Collective | vendor_id=39bc9095-be0b-438a-bda5-105d5da71e35 | bot=bot15 | date=8/2025 ===
# Sarah Roshan Collective (Breckenridge) — vendor_id=39bc9095-be0b-438a-bda5-105d5da71e35
site=https://www.sarahroshan.com/?utm_source=google&utm_medium=organic&utm_campaign=google_my_business&utm_content=breckenridge | instagram=@sarahroshanphoto | google 5★ × 31

## site pricing/package lines
Denver Colorado Wedding Photographer Prices. Enquire Now
contact blog WEDDINGS elopements about home
CLICK HERE visit our elopement page
Every love story is different, and your wedding should reflect that. That’s why we don’t believe in one-size-fits-all packages. Instead, we work with you to create custom coverage that fits your day, your priorities, and your pace.
We provide all services related to weddings and couples so a 3 hour elopement package looks much different than a full day wedding package.
We have options for 2nd & 3rd photographers, heirloom albums, wall art, prints, welcome dinner coverage, engagement sessions, and more.
All our packages come with a digital print release for all personal use, which means you can print your images, share them, and make your own albums if you'd like to.
We customize every package to reflect the unique needs of your wedding day - because no two celebrations are the same and we have two different levels.
We work with couples all over the world, and some locations or dates may have higher minimums and all travel is always included in our proposals. For the most accurate pricing, reach out for a personalized quote - we’re happy to help you find the perfect fit for your day.
We offer both standalone video coverage and bundled photo + video collections to fit your vision. Video-only packages start at $4,000 for shorter coverage and go up to $8,000–$9,000 for full-day storytelling with all the bells and whistles.
When you book photography and videography together, we offer bundled pricing to make the process more seamless—and more valuable. No matter which path you choose, we’ll help you build coverage that reflects your day and what matters most to you.

## google reviews (top 3)
- (5★ 2023-11) My husband and I recently had the pleasure of working with Sarah Roshan and her photographer, Lisa, for our destination wedding in Colorado, and we couldn't be more thrilled with the results. From start to finish, Sarah demonstrated a level of professionalism, creativity, kindness, passion that truly exceeded our expectations even with unexpected storms, needed timeline adjustments, a moose sighti
- (5★ 2022-08) We would first like to start off by saying Sarah is absolutely lovely to work with and she is by far the most talented wedding photographer I’ve ever seen. Our wedding was in June in Vail, CO. She captured the mountains, the village, the chapel and the special moments I asked for from the beginning. Our engagement photos almost a year ago turned out amazing as well. The day of the wedding, I hones
- (5★ 2025-11) My husband and I were blessed with an incredible group of vendors for our wedding, and Sarah and her team were truly at the top of the list! We wanted a photographer local to the area who knew our venue well and could guide us to the best locations for photos—and Sarah was exactly that and more. From the moment we met her for our engagement session, we clicked instantly. Even my husband (who is no

=== PHOTOGRAPHER: Sean Lara Photography | vendor_id=97d177ae-51cb-48fd-a7a9-6c4f103b91be | bot=bot16 | date=6/2025 ===
# Sean Lara Photography (Fort Collins) — vendor_id=97d177ae-51cb-48fd-a7a9-6c4f103b91be
site=http://seanlara.com/ | instagram=@seanlaraphotography | google 5★ × 122

## site pricing/package lines
Pricing - Fort Collins Wedding Photographer | Denver Wedding Photographer | Colorado Wedding Photography | Sean Lara Photography
Weddings &#038; Elopements
WEDDING, ENGAGEMENT & ELOPEMENT PRICING
All Wedding, Elopement and Engagement collections include:
√ Approximately 50–75 images per hour of coverage (with no cap on the total number captured or delivered)
√ Customizable options including additional photographers, fine-art albums, prints, and more
Get My Full Pricing Guide
Full Day Coverage from $4875
Most couples invest $7500, with collections thoughtfully tailored to reflect your unique needs.
ELOPEMENT PHOTOGRAPHY
Engagement sessions offer a fun and refined introduction to working together &#8211; creating space for ease and connection with beautifully composed imagery in remarkable locations. Sessions are available throughout Colorado, with frequent travel to destinations worldwide.
Check Availability & Get Pricing
Wedding & Elopement Photography
Check Your Date & Get Pricing
I specialize in weddings, elopements, and portraits that highlight the connection between couples and the places they love. Whether it’s just the two of you and your dog, or a full-on celebration with 400 of your closest friends, I’m your guy.
You only get one chance to experience your wedding day. With full day coverage included in every package, you can stay present with your family and friends knowing every meaningful moment is being captured.
Every Wedding Package Includes -
✔  No Travel Fees in Colorado
CHECK MY AVAILABILITY & SEE PRICING

## google reviews (top 3)
- (5★ 2026-01) ⭐️⭐️⭐️⭐️⭐️ If there is one thing we absolutely did right when planning our wedding, it was hiring Sean Lara Photography. Without question. We are completely blown away by our photos. They are beyond anything we could have ever imagined. Every single image brings us right back to how the day felt, the emotion, the joy, the quiet moments, the chaos, the love. Sean didn’t just take pictures; he told 
- (5★ 2026-02) Sean was absolutely the best Colorado Wedding Photographer! He photographed both our engagement pictures and our wedding and I couldn’t be happier with the results! He was professional, funny, and a downright fantastic photographer! He had an eye for creative and beautiful backgrounds which made our photos unique and one of a kind. He did everything we wanted and so much more. I couldn’t have aske
- (5★ 2026-02) Sean did my engagement shoot and my wedding. I’m so glad he did. He took two normal people and produced absolutely incredible photos we will have forever. I can’t thank him enough. Thank you, Sean, for your attention to detail and artistic vision. It made our engagement photos and wedding photos amazing.

## region pricing digests
- [launchintel] Sean Lara Photography | also serves destination weddings

=== PHOTOGRAPHER: Shell Creek Photography | vendor_id=691184c3-8d01-4476-b739-9ffe18730a4a | bot=bot17 | date=1/2025 ===
# Shell Creek Photography (Montrose) — vendor_id=691184c3-8d01-4476-b739-9ffe18730a4a
site=https://www.shellcreekphoto.com/ | google 4.9★ × 67

## site pricing/package lines
Colorado Elopement Packages & Pricing | Shell Creek Photography
Colorado Elopement Packages & Adventure Wedding Pricing
Creating colorful memories & guiding you through an epic, stress-free elopement! I offer small outdoor wedding & adventure elopement elopement packages in Colorado, the western U.S. & beyond!
THAT&#8217;S WHY PLANNING ASSISTANCE IS INCLUDED WITH EVERY ELOPEMENT PACKAGE!
Elopements & outdoor weddings allow me to share the amazing outdoor places I love with couples who then make these locations their special places.
Who made the rules, anyway? Stop chasing what a wedding ‘should’ be & start dreaming about everything your elopement could be.
Who says your elopement day has to follow the rules?
Forget the tired traditions & focus on what really matters—with an epic elopement package that feels like one big, unforgettable adventure, packed with everything you love to do together. This isn’t about checking boxes; it’s about breaking them.
What Can You Do at an All Day Elopement?!
Full day elopements allow you time to go to some truly amazing locations & you can also get away to more secluded spots.
Full day elopements give you time so you aren&#8217;t rushed. Use that time to relax or be spontaneous with something fun!
With plenty of time during the full day, you can spend time with your guests & also have time for just the two of you.
Have a Full Day To Spend Together
Why shouldn&#8217;t elopements be a full day? It&#8217;s the day you get married & you should spend the day making memories together.

## google reviews (top 3)
- (5★ 2025-11) Malachi was absolutely incredible - so much so that it is hard to put into words. Choosing him for our adventure elopement/micro wedding was so much more than simply choosing a photographer (though he is truly an awe-inspiringly talented one). What first caught our eye was his photos (especially his nighttime star photos - a specialty of his), but it was ultimately his professionalism, personality
- (5★ 2025-08) Absolutely blown away by the photos we have received so far! Malachi was a dream to work with and so thoughtful and lovely. Just an all-around amazing human being. So many people told me that their biggest wedding regret was not getting the right photographer. I'm so grateful we went with Malachi and Shell Creek Photography. We were truly blessed to have him as our photographer. Thank you for maki
- (5★ 2025-12) Words cannot describe how incredible Malachi was throughout our entire elopement process. He was so easy to communicate with and made planning our day fun and stress free. He listened to every idea we had and made them come to life. He was extremely knowledgeable about our elopement location (Moab, Utah) and helped us plan out the perfect day. He managed to squeeze every possible location we wante

=== PHOTOGRAPHER: Shelly Anderson Photography | vendor_id=fe082916-5673-401b-a119-b6e2d9416f8c | bot=bot1 | date=11/2025 ===
# Shelly Anderson Photography (Arvada) — vendor_id=fe082916-5673-401b-a119-b6e2d9416f8c
site=http://www.shellyandersonphotography.com/ | google 5★ × 38

## site pricing/package lines
Top 20 Colorado Engagement Session Locations
Tips for Engagement Sessions with Dogs
Best Time of Year for Engagement Sessions in CO
When working together for your wedding, you are not only getting beautiful photo memories, but a complete wedding experience. After a nice chat about getting to know your wedding needs, we will create a curated wedding photography package that will best suit your needs.
-8 hour to full day wedding coverage
-destination packages
-film included in ALL packages
***Please note that I do offer off season pricing, mid-week pricing, and micro wedding pricing options***
I have been including film into all of my wedding packages, both 35mm and medium format. If you're interested in seeing some of the film scans, click below!
Albums can either be included into your wedding package or offered a la carte at a later date down the road. I do heavily believe that having a tangible heirloom of your memories is priceless and well worth the investment.
Read more about albums
check out the blog Click here for pricing

## google reviews (top 3)
- (5★ 2025-09) We’ll never be able to say enough positive things to truly capture the incredible experience we had with Shelly. She photographed both our engagement session and our wedding, and we could not be more thrilled with the results. We wanted photos that felt true to who we are—documentary-style, but still light, romantic, fun, authentic, and beautiful—and Shelly delivered exactly that. One of the best 
- (5★ 2026-03) Shelly captured our wedding in Colorado last fall, and we simply cannot say enough positive things about our experience with her. She was extremely professional, kind, and communicative throughout the entire process. As two people who are camera shy, Shelly's grounded presence helped us feel calm and at ease. She perfectly balanced capturing the exciting, high energy parts of our day as well as th
- (5★ 2024-10) We couldn't be happier with our wedding photography experience with Shelly! From the moment we met her for our engagement session, she made us feel completely at ease in front of the camera. Her warm and calming energy truly enhanced our special day, allowing us to focus on the love and joy we felt. Shelly captured every moment beautifully, showcasing not just our love, but also the happiness of o

=== PHOTOGRAPHER: Sierra Sturt Photo, Vail Photographer | vendor_id=d73b478d-16a0-4815-9c66-22ac27cf6c0d | bot=bot2 | date=10/2025 ===
# Sierra Sturt Photo, Vail Photographer (Minturn) — vendor_id=d73b478d-16a0-4815-9c66-22ac27cf6c0d
site=https://sierrasturt.com/all | google 5★ × 137

## site pricing/package lines
What kind of investment are you looking to make?
Together, we can craft a collection of images that not only look exceptional but also elevate your brand, promote your event, and make a lasting impact on attendees and clients.
Artful Engagement Sessions in Vail Village
Ready to plan your Vail proposal or Engagement Session?
Vail Elopement Photography

## google reviews (top 3)
- (5★ 2026-05) From the moment we booked Sierra (and her husband Zane for videography), we knew we had made the right choice—and somehow they still exceeded every expectation. We originally chose Sierra because of her style: bright, vibrant, and so full of life and love. But what truly sets her apart is the experience she creates. Planning a wedding in Southern California while they’re based in Colorado could ha
- (5★ 2025-12) If you’re reading this and still searching for a photographer, stop here and hire Sierra. 10/10 personality and 11/10 photos!!!! She is down to earth with a heart of gold 💗 Her natural ability to make you feel comfortable in front of the camera was amazing. I was nervous for our first family photos with a baby, but Sierra made it so easy… I didn’t even feel like we were posing for photos. I wish 
- (5★ 2026-01) Sierra didn’t just photograph our engagement—she helped create one of the most meaningful moments of our lives. From the very beginning, her constant communication and deeply personal approach made us feel completely taken care of as a couple. Planning an engagement from Monterrey, Mexico, without knowing Vail, the locations, or what to expect, was intimidating. Sierra gave me confidence from day

=== PHOTOGRAPHER: Signature Destination Photographers | vendor_id=afbf1a99-0974-4ada-a2f1-d49b8cf81e41 | bot=bot3 | date=4/2026 ===
# Signature Destination Photographers (Avon) — vendor_id=afbf1a99-0974-4ada-a2f1-d49b8cf81e41
site=https://www.signaturephotographers.com/ | google 5★ × 45

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2026-03) We had an incredible experience working with Chris for our family photos at the Ritz-Carlton in Beaver Creek. From start to finish, he was professional, prompt, and extremely easy to work with. Chris has a great eye for location—he guided us to some beautiful spots around the resort that made our photos feel both natural and elevated. The quality of the images exceeded our expectations, communicat
- (5★ 2026-02) Chris went way above and beyond! He is a fun, respectful, hardworking, personal, and talented photographer. His communication was timely and his intentionality gave me confidence prior to even meeting him. When it came to the day of, he was perfectly on time and brought so many fun ideas to capture the many angles of our engagement. At one point he was knee deep in an icy river to get a shot of me
- (5★ 2025-09) Chris was professional, accommodating and charming throughout both the planning and the photo shoot phase of our engagement. Things went perfectly and we have so many memories to cherish, which we will always be grateful to Chris for. Couldn’t imagine there is anyone doing a better job, and would highly recommend him for any of your big moment capturing needs!

=== PHOTOGRAPHER: Siroky Photography | vendor_id=17e1904c-56a3-40bb-98ca-df3fd8fe233c | bot=bot4 | date=1/2025 ===
# Siroky Photography (Colorado Springs) — vendor_id=17e1904c-56a3-40bb-98ca-df3fd8fe233c
site=http://sirokyphotography.com/?utm_source=GMBlisting&utm_medium=organic | google 5★ × 231

## site pricing/package lines
Baby's First Year Package
Get the Essential Collection: $2500
Additional Hours $750
Everyone's wedding is unique. If these packages don't quite fit what you are needing, please contact us to see if we can accomadate your needs.
Unleash Your Imagination: Explore Our Collection
Wedding Photography starts at $2500
Unleash Your Imagination: Explore Our Captivating Collection
Engagement Photography starts at $500
Why Choose Siroky Photography for Your Engagement Session
Ready to Book Your Colorado Springs Engagement Session?
Sharing & Printing: Receive high-resolution digital files plus options for prints, albums, and wall art.

## google reviews (top 3)
- (5★ 2024-05) Jerry has a great eye and does an amazing job at capturing memories for your event. We used Jerry for our wedding and couldn't be happier with the results! We received so many compliments from how the photos turned out and the energy that Jerry brings to his work is infectious. He is very professional, but is easy-going enough to make everyone feel comfortable. Would highly recommend him for any e
- (5★ 2026-04) My family and I just had family pictures done and they were amazing, great quality photos so many options. Jerry is a very talented photographer he has great taste and sees beauty in everything, he makes you smile and laugh. He has an eye for scenery, his talent surpasses many others. I highly recommend him to anyone for every occasion. He is kind and friendly. He is part of our community and brin
- (5★ 2025-10) Jerry was an amazing photographer to work with and the utmost of professionals. This was only our second time doing family photos. He gave us a recommended place along with the best time shoot at this location. He even gave the guidance that we should look up outfits and poses that we like which was a huge help but in the end he told us what to do on the spot. This made us less nervous not to ment

=== PHOTOGRAPHER: Sky Pond Photo & Video | vendor_id=e176fe36-52dd-43f3-b3a8-bf167c5154c8 | bot=bot5 | date=1/2025 ===
# Sky Pond Photo & Video (Estes Park) — vendor_id=e176fe36-52dd-43f3-b3a8-bf167c5154c8
site=http://skypondphotovideo.com/ | google 5★ × 117

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-09) If you are planning a trip to Estes Park, and want to have pictures taken. I have the man for you Sky Pond Photo & Videos. Alex is an amazing photographer. 20 plus yrs of experience. Any occasion, and his prices are reasonable. Me and My Husband used Alex when we done our Wedding Shoot in Estes Park (Marina Park) what a Beautiful Place it is. Alex made our shoot, fun, relaxing, and stress free. We
- (5★ 2026-05) I shot my proposal photos and my engagement photos with Alex, and where do I start?! As a professional photographer and videographer myself I had high standards. Everything from planning my ideas to surprising my now Fiancé with “couples photos,” turned into getting down on one knee, went flawlessly. Alex took us to some absolutely breathtaking locations, knew how to be super flexible with the wea
- (5★ 2026-05) We had the pleasure of working with Alex with Sky Pond Photography during our vacation in Estes Park, and the entire experience exceeded our expectations. From the moment we met, Alex made our family feel comfortable and truly able to enjoy the moment. The session was fun and beautifully captured the scenery and spirit of our time in RMNP. Alex took us to 2 incredible locations for our photo shoot

=== PHOTOGRAPHER: Snappr Photography | vendor_id=2011f3cf-2537-4dc7-a27d-aef9014da132 | bot=bot6 | date=4/2026 ===
# Snappr Photography (Boulder) — vendor_id=2011f3cf-2537-4dc7-a27d-aef9014da132
site=https://www.snappr.co/best-photographers/boulder-co?utm_source=google&utm_medium=organic_gmb&utm_campaign=gmb&utm_term=na&utm_content=na | google 4.7★ × 10

## site pricing/package lines
Photos taken per hour in Boulder 1,105
Find photographers starting $89 Find photographers from $89

## google reviews (top 3)
- (2★ 2019-07) I have really mixed feelings. The first time I used it, the experience was great. Fast, responsive customer support, good photographer, nice photos. I would give five stars. The second time, maybe 6 month later, is frustrating. Maybe their business model changed or something. First of all, I was browsing at some point and didn't book anyone yet. Then I received a very passionate phone call from th
- (5★ 2019-02) Great experience. It was easy to schedule ( I scheduled a shoot in the evening and had it done the next morning) The photographer was on time, professional, took great shots - I got them back on 24 hours. This was so easy and fast. I didn't need to search, arrange, wait and still not know who your getting at twice the price. For what I wanted, this is brilliant.
- (5★ 2022-09) I would recommend Zack for any and every event you can book with Snapr! The customer service from him and Snapr was out of this world! They made sure my surprise engagement photos went off without a hitch!

=== PHOTOGRAPHER: Sonnenalp Vail | vendor_id=77719076-ce2b-4228-87c9-f599f2db8c25 | bot=bot7 | date=2/2026 ===
# Sonnenalp Vail (Vail) — vendor_id=77719076-ce2b-4228-87c9-f599f2db8c25
site=https://sonnenalp.com/ | google 4.7★ × 924
google summary: Upscale quarters near the ski slopes with 4 restaurants, a golf course, & a spa with 2 pools.

## site pricing/package lines
(none found on site)
pdf rate cards seen on site (not fetched): https://sonnenalp.com/wp-content/uploads/2022/06/RMB-Wintertime-Bliss-2022.pdf

## google reviews (top 3)
- (5★ 2026-05) As a local Vail Wedding Photographer, the Sonnenalp truly cannot be beat. The alpine, cozy, elevated feel and the location - prime. I am so grateful to be able to step foot in the Sonnenalp Hotel whenever I am in the village - it is truly one of the most beautiful and cozy spots.
- (5★ 2026-05) We stayed at Sonnenalp Vail as part of the Amex Fine Hotels & Resorts program, and the experience felt both elevated and intimate from the start. Visiting during the off-season turned out to be a hidden advantage-the hotel was uncrowded, which made everything feel more personal and relaxed. What stood out immediately was the warmth of the staff. Every interaction felt genuine, with team members go
- (5★ 2026-06) This is a great property. We stayed through Amex FHR and the property exceeded all our expectations. Dinner at the restaurant and phenomenal breakfast buffet that had pretty much everything you will desire. If you do desire more, ask and they might be able to accommodate your dietary needs. And the breakfast area with all the light, it was magical. The pool area is nice outside and next to the riv

=== PHOTOGRAPHER: Sophie Catherine Photo | vendor_id=3478ac1c-465d-4b47-bb41-88fc4cf3836e | bot=bot8 | date=6/2026 ===
# Sophie Catherine Photo (Denver) — vendor_id=3478ac1c-465d-4b47-bb41-88fc4cf3836e
site=https://www.sophiecatherinephoto.com/ | instagram=@sophiecatherinephoto | google 5★ × 54

## site pricing/package lines
Investment - Sophie Catherine Photo
An Investment You'll Never Regret
Couples on average invest $5000-$7000+
Couples on average invest $3000+
Family, maternity, newborn, etc starting at 1 hour for $550
Engagement & couples sessions starting at 1 hour for $650
All wedding & elopement packages have a la carte options including a $450 engagement session if you book your wedding or elopement with me!
denver boho rooftop-elopement |javeon + paige
A photojournalist of weddings & elopements for the nostalgic and deeply in love.
Denver Boho Rooftop Elopement | Paige + Javeon - Sophie Catherine Photo
Think a city elopement is what you and your partner would like to do? Inquire here !
A- Oh heckkkk yeah. Traveling to new places is when I feel the most inspired! You can add travel onto any of my packages, I'll meet you wherever you want me.
A- Each session/wedding is different, but you can expect a minimum of 65 images per hour.
Rocky Mountain National Park Engagement Session | Abigail + Ben - Sophie Catherine Photo
Rocky mountain national park engagement session | abigail + ben
If you'd love to explore Rocky Mountain National Park for your engagement session or would love to elope somewhere in the park, inquire here !

## google reviews (top 3)
- (5★ 2023-11) Sophie is the BEST!!!! My wife and I reached out to her to shoot our wedding in Detroit, and we wouldn’t have wanted to work with anyone else. She was extremely helpful in the planning phase, meeting with us multiple times to make sure we were getting exactly what we wanted (for both our wedding day and rehearsal dinner!). Throughout the wedding day chaos, she was extremely organized and made sure
- (5★ 2023-09) I wholeheartedly recommend Sophie to anyone who is looking for an attentive, talented and friendly photographer. She was the only vendor who I was 10000% certain that I needed on my wedding day - I love her editing style, composition and overall aesthetic. Sophie is a true professional: delivers quality work, is transparent on pricing, incredibly reliable and knowledgeable. She worked with me to u
- (5★ 2024-09) Sophie is the BEST photographer around! Several of my family & friends have had Sophie as their wedding photographer & she truly has become a friend. She provided us with a detailed elopement guide & helped us develop the timeline for the whole wedding day. From her organization skills to sweet & creative personality she is a wonderful person & amazing photographer! Our photos from the wedding day

## region pricing digests
- [launchintel] Sophie Catherine Photography | wedding and elopement photographer

=== PHOTOGRAPHER: Southwest Durango Photography LLC | vendor_id=d6341b44-4405-40bc-ba0b-fbd20cf62d49 | bot=bot9 | date=3/2025 ===
# Southwest Durango Photography LLC (Durango) — vendor_id=d6341b44-4405-40bc-ba0b-fbd20cf62d49
site=http://www.swdurangophotography.com/ | google 5★ × 63

## site pricing/package lines
Durango-Photographers-Wedding-Elopement-Gallery - SOUTHWEST / DURANGO PHOTOGRAPHY
Wedding / Elopement Gallery
Weddings / Elopements / Engagements Gallery
Wedding Photography Packages range from $2400 to $3800 from 4-8 hours depending on size and amount of time requested.
(Hourly rates are available for clients seeking less hours for their wedding.)
For Weddings expecting 100+ people a second photographer is recommended and available for $800 (or $500 for 1/2 day)
*All online galleries come with photo printing options including glossy, canvas, acrylic, photo albums, and more!
SOUTHWEST / DURANGO PHOTOGRAPHY - Durango-Photographers Durango-Wedding-Photographers Elopements
Colorado Wedding Photography and San Juan Mountains Elopement Photography
Wedding and Elopement Packages
&#8203;Prices range from $2400 to $3800 for weddings. Click above for more information.
(Hourly rates are available for clients seeking less hours for their wedding or elopement.)
Colorado Elopement Packages
Colorado Wedding photography Packages
If you would like to peruse my landscapes gallery follow the link below! All images are available for purchase. Contact me to discuss size, style, and pricing.
Serving the Durango, Silverton, Ouray, Telluride, Ridgway, Hesperus, and Mancos areas, as well as the Desert Southwest. To peruse my elopement packages in Colorado, Utah, or New Mexico click here:
Colorado Elopement Packages-Durango Elopement - SOUTHWEST / DURANGO PHOTOGRAPHY
All elopement packages include the following:
(Hourly rates are available for clients seeking less hours for their elopement.)

## google reviews (top 3)
- (5★ 2024-07) We arranged a photo shoot with Andy for our large family of 16 people (half of them being small children!) for our parent’s 50th wedding anniversary. From the very beginning Andy was incredible. We were from out of town, so he was able to help us choose a location as well as work us into his busy summer schedule. The day of the shoot we thought we were going to be in for a long morning of trying t
- (5★ 2025-10) We worked with Andy to shoot our wedding at the rustic Eureka Lodge in Silverton, and could not have asked for a better experience! First off, the photos are amazing and exactly the style we were hoping for; he's very familiar with the area and the venue so could lead us to the most epic shots, with full coverage of the whole event. Also we had a more laid back and flexible wedding with a lot of n
- (5★ 2024-09) Andy was above and beyond what we had expected of a photographer. He was kind and encouraging and worked with our arrangements. Everyone at our wedding commented about how amazing he was! The photos turned out fantastic and he captured exactly what I was looking for! 10/10 would recommend!!!

=== PHOTOGRAPHER: Story Lens Photography : Portrait Photographer | vendor_id=fcdf5f25-b179-4c92-bd80-2b8499646cf4 | bot=bot10 | date=1/2026 ===
# Story Lens Photography : Portrait Photographer (Avon) — vendor_id=fcdf5f25-b179-4c92-bd80-2b8499646cf4
site=http://www.storylensinc.com/ | google 5★ × 24

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-11) We can't say enough good things about our YEARS of working with Lisa and Story Lens Photography. Lisa has photographed our family almost every year since our kids were born and even successfully pulled together a session with our extended family of around 20 of us (eight little ones too)! Her talent, professionalism, authenticity, humor and incredible creativity with locations and ideas come throu
- (5★ 2024-01) If you are looking for an excellent family photographer, look no further! Lisa did an incredible job capturing our huge family of 16! She made the whole process super easy. She captured us perfectly! She even managed to get beautiful smiles from the toddlers and the teens, which is not an easy task. We love our photos and are so glad that we found Lisa!
- (5★ 2025-10) Lisa was fantastic! Not only is she talented, she is incredibly considerate and worked with us to alter our shoot time to accommodate our infant’s unpredictable schedule. Our photos turned out beautifully and we will cherish the sweet moments she captured!

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-12.csv
