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


=== PHOTOGRAPHER: Bonnie Photo | vendor_id=0229fa2d-8623-44e5-9a7d-990793db0299 | bot=bot12 | date=9/2025 ===
# Bonnie Photo (Erie) — vendor_id=0229fa2d-8623-44e5-9a7d-990793db0299
site=https://bonnie-photo.com/ | google 5★ × 60

## site pricing/package lines
Wedding Photo Packages for Unconventional Colorado Couples | Bonnie Photo
Inclusive Colorado Wedding Photography Packages
From our first meeting with Bonnie, to our engagement session, through wedding planning, and finally our big day, she was absolutely amazing to work with.
All wedding packages include a
complementary engagement session
All packages include:
Complimentary engagement session
Complimentary album design
Pricing starts at $3800
Let&#8217;s make it official! The process is simple: sign the contract, submit your deposit, and your date is secured!
I consent to receive marketing text messages from Bonnie Photo at the number provided. Message frequency varies. Message & data rates may apply. Text HELP for assistance. Reply STOP to opt out.
Get Wedding Package Details
2. Make it official  – Choose your package, sign the contract, and submit your deposit.
I’ve got your back from “What the heck are we doing?” to the last dance to gallery delivery and album ordering. I’ll guide you, support you, and hype you up every step of the way.
Whether you&#8217;re planning a dreamy botani gardens elopement or bringing donkeys to your reception (been there, shot that), I&#8217;m here for whatever makes your day yours .
Authentic, relaxed engagement sessions that capture your love story, your way.
Fun, Offbeat Engagement Sessions in Colorado
Bonnie Photo: Fun, Relaxed Colorado Engagement Sessions
Engagement Portrait Packages
I care about working with couples from all backgrounds. This means I have collections for everyone.

## google reviews (top 3)
- (5★ 2026-01) ​Bonnie was absolutely incredible to work with for our engagement photos and wedding. She is communicative, kind, timely, thorough, and captured the most incredible photos. Every important moment of our wedding was captured perfectly. Our engagement session really helped us form a bond with her that made our wedding photos go more smoothly as neither my wife or I are very fond of photos. She put u
- (5★ 2022-05) I think I'd struggle to find the proper words to describe the talent that is Bonnie Sizer & Michael Kory of Bonnie Photo, but I'll give it a shot.. Bonnie & Mike are kind, creative, consummate professionals, and I can't imagine having anyone else for our photography needs. Bonnie Photo has completed our Proposal, Engagement, & Wedding photos with the most creative flair and attention to detail tha
- (5★ 2019-08) We hired Bonnie and Mike to photograph our wedding and could not be happier! Their shots were perfect and they were absolutely amazing to work with. We've received numerous compliments on the final pictures from others in attendance. They have a true knack for catching just the right moments and really went the extra mile to ensure all the final pictures were of the highest quality. We can't recom

## region pricing digests
- [launchintel] Bonnie Sizer / Bonnie Photo | $3,800 starting per WPJA; engagement session included free with wedding package; LGBTQ+ and BIPOC inclusive; candid, bold, vibrant editing; based in Boulder county/Erie, serves mountain settings | https://bonnie-photo.com
- [launchintel] Mike Kory Photography | $2,800 starting per WPJA; mechanical engineer turned destination wedding photographer; documentary-style; associate photographer at Bonnie Photo; off-camera/dusk lighting for night shots; no independent website surfaced (works under Bonnie Photo)

=== PHOTOGRAPHER: Bound for the Mountains | vendor_id=49ef1958-c1de-4211-912d-914e8b66aff1 | bot=bot13 | date=9/2025 ===
# Bound for the Mountains (Breckenridge) — vendor_id=49ef1958-c1de-4211-912d-914e8b66aff1
site=http://boundforthemountains.com/ | google 5★ × 4

## site pricing/package lines
Bound for the mountains is a team of local mountain photographers that know the area well. We are natural planners and know the best lighting and locations. We are a collection of the best photographers in the mountains who provide exceptional high touch services and beautiful images.
3 Elopement Planning Essentials You Can’t Afford to Overlook
Elopement planning essentials are often overlooked because couples expect things to cost less, take less time to plan, and for venues not to be as hard to find.  I see it all the time… couples assume that elopement planning is simple because they’re skipping the big...
Checklist for Planning a Mountain Elopement
Your Complete Mountain Elopement Planning Checklist Here's a checklist for planning a mountain elopement in any season in Colorado, with time estimations for each item to ensure everything runs smoothly: Choose your destination: Choose a mountain...
THE ELOPEMENT PLANNING SHOP
Best Elopement Photographer in Colorado - Bound For the Mountains
Colorado Elopement Photography
If you’re seeking elopement photography in Colorado, then first of all, congratulations!
Elopements are part of what we love.  Something so intimate is so deeply heartfelt, and our images reflect that.
Elopements are part of what we love.
Our elopement offerings are for weddings of 10 people or less (or just the two of you!). Our pricing is by coverage and not time, to ensure you select a collection that fits your coverage desires.
Elopements start at $1800.
What is included in Colorado Elopement Photography Collections?

## google reviews (top 3)
- (5★ 2023-02) I wish I could give Bound for the mountains more than 5 stars, they deserve it! My fiancé and I recently traveled to Breckenridge and little did I know, I’d be paired with a photographer on a dog sledding trip and be getting proposed too! My fiancé contacted Andrea and Rachel from Bound to the mountains months ago and planned a surprise engagement while we were dog sledding. Andrea and Rachel were
- (5★ 2023-02) There aren’t enough words in colorado to express how incredible our experience with Rachel and Andrea was or how special our photos came out! This is truly a special photography group, and the love, care, and kindness comes through in all their interactions and photos taken. When Mother Nature had other plans for our outdoor shoot in the dead of winter, Rachel and Andrea worked with us and every o
- (5★ 2025-03) They deserve MORE than 5 stars. Absolutely phenomenal from start to finish. I could not recommend them more. We had a surprise proposal planned and between the planning weeks prior, communication and execution - this was absolutely perfect. They are a MUST USE. Worth every single penny. Seriously, look no further!

=== PHOTOGRAPHER: Breckenridge Photographers | vendor_id=6a3a4591-f474-4f56-885f-80a2a8796762 | bot=bot14 | date=8/2025 ===
# Breckenridge Photographers (Breckenridge) — vendor_id=6a3a4591-f474-4f56-885f-80a2a8796762
site=http://www.breckenridgephotographers.com/ | google 5★ × 5

## site pricing/package lines
Breckenridge Proposals, Family Photos, Engagement Sessions, Ski Weddings
To lock in your date, we require a 50% deposit and a signed contract. If we’re a good fit and you're ready to move forward, we'll send everything over and make this official. A 50% deposit is required to secure your date.
Ready to pop the question? We offer expert advice on the best location and time of day to propose. And provide priceless photos to remember and share this moment.
*All engagement or proposal sessions are applicable towards a full wedding package anywhere in the world with our sister company.
packages start at 895 midweek
Click here to view our packages

## google reviews (top 3)
- (5★ 2021-02) Sarah did our ski/snowboard elopement wedding photography. She was wonderful! She was really flexible with our quick timetable, knew Breckenridge slopes and where the best spots were for all the views. She was very helpful and answered all of our questions. The pictures came out amazing. She captured us and our personalities. Could not have asked for better.
- (5★ 2022-04) Had a wonderful experience with Sarah for our wedding up on Boreas Pass. She was thorough with the pictures but also quick to get all the good shots. Even more wonderful was nearly 2 years later when I couldn't find the save pictures and she still had them available for us. I would definitely recommend her services!
- (5★ 2023-06) Sarah and Lisa were absolutely wonderful to work with! We did a large, multigenerational family photo shoot and had a lot of people to wrangle. From planning to the actual photo shoot, all details were thoughtfully considered and communicated and resulted in beautiful pictures that our family will treasure. We would love to work with Breckenridge Photographers again and highly recommend their serv

=== PHOTOGRAPHER: Breckenridge Photographics | vendor_id=4968e059-d2d2-4b82-83f5-6f34f9c5ef28 | bot=bot15 | date=7/2025 ===
# Breckenridge Photographics (Breckenridge) — vendor_id=4968e059-d2d2-4b82-83f5-6f34f9c5ef28
site=https://www.facebook.com/breckphoto/?ref=bookmarks | google 4★ × 154 | SITE CRAWL FAILED (HTTP 400)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2026-01) David has been nothing but knowledgeable to me, and very professional. I originally found his store a few years ago, wandered in because it is truly one of a kind, and I have been coming back since. This past September, I came in to learn more about digital camera's. After spending many days coming in to visit with David, emailing back and forth on a respectable timeline, and many hours of doing m
- (5★ 2026-01) Man where to begin. I visited Breckenridge photographics for the first time this week and David provided more then just customer service, He provided a whole experience. This was my second time in breck and I happened to walk by his shop, and boy am I glad I did. The first time I walked in just to buy some film, and he left such an impression on me I had to come back the next day just to hear his 
- (5★ 2026-01) David was incredibly knowledgeable in helping my daughter choose the right film camera — both for hobby photography and potential professional use. He took the time to walk her through everything, was direct and patient with all of her questions, and did it all while juggling multiple other customers. He clearly knows his stuff and gets straight to the point without any fluff. If you need anything

=== PHOTOGRAPHER: Breckenridge Portrait Company | vendor_id=456a62d4-8a36-4223-b61d-a04db395ed7f | bot=bot16 | date=2/2026 ===
# Breckenridge Portrait Company (Breckenridge) — vendor_id=456a62d4-8a36-4223-b61d-a04db395ed7f
site=https://breckportrait.com/ | google 3.7★ × 3

## site pricing/package lines
Journeys Captured: Breckenridge Portrait Company Photography Collection

## google reviews (top 1)
- (5★ 2023-04) This review is long over due. We had a Christmas Eve family photo shoot scheduled. Unfortunately, we got stuck in the snow because we had a rental SUV that had 2 wheel drive, resulting in us being late! Scott had infinite patience with our family including a toddler who needed her nap. He was the consummate professional. The pictures he took were amazing! His sense of humor and calm demeanor erase

=== PHOTOGRAPHER: Brenna Nicole Photography | vendor_id=a73e1b4c-56d9-4720-959d-8d4c288867ed | bot=bot17 | date=5/2025 ===
# Brenna Nicole Photography (Lone Tree) — vendor_id=a73e1b4c-56d9-4720-959d-8d4c288867ed
site=http://brennanicolephotography.com/ | google 5★ × 105

## site pricing/package lines
Colorado Elopement Packages | Brenna Nicole Photography
Colorado Elopement Packages & Pricing
helping you live your wildest Elopement dreams
Most couples reach out knowing just one thing — they want to elope. That’s where I come in. I&#8217;ll guide you through the when, where, and how of an elopement day. I&#8217;ll help you craft a seamless, intentional Colorado elopement experience from the ground up.
Meet your Colorado elopement photographer
Hi my name&#8217;s Brenna! Choosing the right photographer for your elopement means investing in someone who you connect with.
Elopements are an intimate affair and you want to spend the day with someone who allows you to feel unapologetic for who you are. And I can guarantee you that I will 100% deliver on this.
I prioritize each of my clients experience and happiness above all else. I will value you, respect you, and empower you because there is so much more to elopements than just photos.
Included in Every Elopement Package
what to expect from your colorado elopement Experience
Your elopement day is all about the two of you—no stress, no strict timelines, just authentic moments and meaningful experiences. We&#8217;ll craft a day that reflects your unique relationship and dreams.
Your elopement isn’t just a ceremony—it’s an adventure that reflects your personality as a couple. Whether that’s a sunrise hike, a private vow exchange, or celebrating with your favorite activity, your day will be uniquely yours.
Elopements that allow you to&#8230;
With my expert knowledge about elopement I can help you narrow down exactly how you want to spend your wedding day. I will help you brainstorm and give you suggestions on locations, activities, and details you can include on your day to make it extra special.

## google reviews (top 3)
- (5★ 2026-03) Prior to our first conversation with Brenna, I was already impressed with the artistic approach she has in capturing such beautiful moments for people. Directly following that intro call I remember turning to my wife and in unison us going, “Gosh I love her!” Brenna guided us through how to make our wedding possible. She is professional, real, and excellent at what she does. She truly captured the
- (5★ 2026-03) Brenna took our vision and made it come to life for our special day. A small, intimate wedding that was as spontaneous as we both are. Not only were our photos magazine worthy but she helped us coordinate the entire day. She kept us on schedule and honestly without her our day would have been chaotic. Brenna will turn our outdoor elopement into the most magical day of your life ❤️
- (5★ 2024-09) Brenna is one of those people that will make you feel like you’ve known her forever! She will make you and your partner feel super comfortable and will help you every step of the way. She photographed my surprise proposal and I couldn’t have been happier with the photos! Brenna is super fun and is great at what she does! P.S I also appreciate that Brenna said yes to taking our photos at such short

=== PHOTOGRAPHER: briadair.jpeg | vendor_id=bb7f786c-307e-448a-9fa5-a319b6b92fb7 | bot=bot1 | date=8/2025 ===
# briadair.jpeg (Littleton) — vendor_id=bb7f786c-307e-448a-9fa5-a319b6b92fb7
site=https://briadair.com/ | google 5★ × 24

## site pricing/package lines
Hey, I’m Bri , a Denver-based photographer documenting elopements and intimate weddings for couples who don't feel at home in traditional wedding spaces.
Overall Value - How would you rate the overall experience and value?

## google reviews (top 3)
- (5★ 2026-06) Bri was wonderful to work with, especially as a couple that is not comfortable being photographed and in the center of attention. Bri was incredibly easy-going and understanding of our go with the flow wedding vibes. We appreciated not feeling rushed or pressured, and were impressed with how many quality photos she took without the focus of the day being on capturing the perfect shots. She offered
- (5★ 2026-05) By far one of my favorite photographers!! She’s so talented and really knows how to get the best angles. On top of being very great at taking the best photos of you she is super kind and will absolutely be my go to photographer for any special event.
- (5★ 2026-05) Bri photographed our family’s baby shower and her work is incredible. She was present, engaged, friendly, and had final photos delivered in record time! We will definitely be using Bri again to capture special days!

## region pricing digests
- [launchintel] briadair.jpeg | Photojournalistic style; starts at $800; weddings, elopements, engagements, proposals

=== PHOTOGRAPHER: Bright Birch Films | vendor_id=d16553f5-2565-4a96-a8f4-3585ea1bfba9 | bot=bot2 | date=2/2025 ===
# Bright Birch Films (Colorado Springs) — vendor_id=d16553f5-2565-4a96-a8f4-3585ea1bfba9
site=https://www.brightbirchfilms.com/ | google 5★ × 36

## site pricing/package lines
WEDDING TEASERS - INCLUDED IN EVERY PACKAGE
ENGAGEMENT FILMS & AERIAL DRONE PACKAGES
AMT - PRECISION INVESTMENT CASTINGS - NEW YORK
Adventure Elopement Photography and Films
Capturing adventure elopements and intimate weddings for the wild and authentic ones.
We create films and photos that evoke nostalgia. Whether we're crafting a wilderness elopement album or a cinematic wedding film, our emphasis is making an emotional final piece.
Authentic photography and video coverage for your adventure elopement in the mountains.
Hey, I'm Bryan Way! My film work lead to an interest in wedding videography and elopement photography, and I quickly fell in love with finding ways to make these projects as unique as possible.
We create cinematic videos for weddings and adventure elopement photography in the Rocky Mountains. However, we will shoot anywhere in the country/world, and regularly travel across the States to film our clients' special days.
Adventure Elopement Vidoe and Photo
Bright Birch Films - Aventure Elopement Photography and Cinematic Films
Adventure Elopement Coverage for the Wild Ones
We’ve been creating authentic cinematic wedding and elopement films for over six years now. We’ve shot video in the deserts, cities and mountains of Colorado. Through snowstorms, heat waves and everything in between.
Do you offer photo and video packages?
I am so excited you are considering Bright Birch to capture your elopement, and we take that trust very seriously - but also be prepared to laugh a lot along the way! Let’s hop on a video chat soon!

## google reviews (top 3)
- (5★ 2024-06) I cannot express how incredible working with Bryan is. He turns everything he touches into a cinematic masterpiece. The care and artistry with which he captured every moment of my wedding was inspiring. Bryan’s communication throughout the whole process was excellent and he had a crazy fast turnaround time for deliverables. The man is dedicated to his craft. Naturally, nothing went as planned on m
- (5★ 2024-07) One of the best videographer and photographer we’ve had. :) Our video and short film turned out so beautiful it has touched ours and our guests hearts with tears of joy. The pictures are beautiful. It’s really a good sign when you see and can tell that your photographer really loves their work and that is shown in the results. Also, we can’t help but forget how our hearts were touched by the kindn
- (5★ 2021-06) Bryan delivered to us the most beautiful, meaningful, and creative video of our wedding day. It is a breathtaking video we will cherish forever and ever and show our children. Bryan is not only a friend of ours but a kind, fun loving, adventurous, generous and talented person. He was an absolute joy to have around on our wedding day as we got ready for our ceremony and beyond. He made us both feel

=== PHOTOGRAPHER: Camara Photography, LLC | vendor_id=86e75ed4-8591-465d-aaae-6b64dcaa692e | bot=bot3 | date=1/2025 ===
# Camara Photography, LLC (Colorado Springs) — vendor_id=86e75ed4-8591-465d-aaae-6b64dcaa692e
site=http://www.camaraphotography.com/ | google 5★ × 20

## site pricing/package lines
For most portrait work, our pricing starts at around $550, and always include high resolution, digital files. For Family, High School Seniors, Events, Sports, Corporate, Events or Portrait work, please contact us (info@camaraphotography.com) for a quote.
Engagement session with Triple Falls Waterfall in the background, outside Asheville, NC

## google reviews (top 3)
- (5★ 2015-08) We cannot say enough positive things about Dave and Peggy of Camara Photography! They shot our engagement photos and wedding photos in 2012 and we are absolutely in love with their work. The price was certainly reasonable for what they offered and we were so grateful that they remained with us until our sendoff. They just wanted to capture the entire experience! Our family and friends were immedia
- (5★ 2016-04) Amazing photographer! We planned a very tiny wedding (just me, my husband, photographer and videographer). Dave was not only extremely accommodating, but he was a phenomenal photographer. We love our photos and I will go back to him for any future photography needs as they also do family shoots. His rates and turnaround time were incredible. We were lucky enough to receive a few edited photos with
- (5★ 2023-03) By far the best photographers we have ever worked with! Not only are the photos amazing but Dave and Peg become your friends! We met them in Costa Rica when they photographed a friends’ wedding and then flew to VT to do ours! They later came back to VT to do my brothers’ wedding. We couldn’t recommend them enough. They also setup a great photobooth! They provide you with the highest quality photos

=== PHOTOGRAPHER: Candace Cross Photography | vendor_id=7bae1ed6-6268-4ebe-8e70-d28a9d09d7c6 | bot=bot4 | date=6/2026 ===
# Candace Cross Photography (Durango) — vendor_id=7bae1ed6-6268-4ebe-8e70-d28a9d09d7c6
site=http://www.candacecrossphotography.com/ | google 5★ × 1

## site pricing/package lines
(none found on site)

## google reviews (top 1)
- (5★ 2018-02) Very professional. Excellent work.

=== PHOTOGRAPHER: Candid Studios Photography & Videography - Colorado Springs | vendor_id=b83db0dc-a268-4fe1-b4fc-2c1a96f65742 | bot=bot5 | date=4/2026 ===
# Candid Studios Photography & Videography - Colorado Springs (Colorado Springs) — vendor_id=b83db0dc-a268-4fe1-b4fc-2c1a96f65742
site=https://candidstudios.net/locations/colorado-springs | google 5★ × 9

## site pricing/package lines
Colorado Springs Event Videographer Pricing
Starting at $350/hr.
We create a detailed production schedule covering all sessions, develop daily highlight packages, and can deliver daily recap videos. Our crew rotates to maintain energy across long events. Multi-day packages include planning, coverage, and daily deliverables.
Photo + Video Pricing
Elopement Photographer
Colorado Springs Wedding Photographer Pricing
What is included in your wedding photography packages?
Do you offer a second photographer for Colorado Springs weddings?
Colorado Springs Wedding Videographer Pricing
When you are ready to talk through dates, coverage hours, or whether to add videography to your Colorado Springs wedding, reach us at (844) 522-6343 or support@candidstudios.net. Current packages are listed on our pricing page, and we are happy to walk you through which option fits your day.
Elopement Photography
The Best Colorado Springs Elopement Photographer for Your Dream Day Read article →
What Your Engagement Session with Candid Studios Looks Like
Colorado Springs Engagement Photographer Pricing
What should we wear for our engagement session?
Can we bring our dog to our engagement session in Colorado Springs?

## google reviews (top 3)
- (5★ 2025-06) We made the perfect choice when we chose Candid Studios for our wedding. There was a professional photographer and professional videographers on their squad, and they were amazing. We wanted Colorado wedding photographers who could show off the natural beauty of our mountain setting and the emotional moments we shared. Candid Studios did a great job on all fronts. They got there early, were very o
- (5★ 2025-08) Candid Studios separated out from the other wedding photographers in Colorado Springs because of their flair and professionalism. On the day of our wedding, their photographer fit right in and took pictures of everything without getting in the way. We also hired them to shoot the wedding video, which was really emotional and like a movie. The pictures and videos showed off our personalities and lo
- (5★ 2025-08) Our wedding in Colorado Springs was magical thanks to Candid Studios. Every picture, from the engagement photos on the mountaintop to the wedding day, was stunning. Their crew of videographers elegantly captured the beauty of our ceremony. They are unquestionably the most skilled, reasonably priced, and imaginative wedding photographers and videographers in Colorado Springs.

=== PHOTOGRAPHER: Candid Studios Photography & Videography - Fort Collins | vendor_id=220cea63-f3ec-4e08-a92c-7470939495d7 | bot=bot6 | date=1/2026 ===
# Candid Studios Photography & Videography - Fort Collins (Fort Collins) — vendor_id=220cea63-f3ec-4e08-a92c-7470939495d7
site=https://www.candidstudios.net/locations/fort-collins/ | google 4.8★ × 99

## site pricing/package lines
Fort Collins Event Photographer Pricing
Starting at $350/hr.
Yes! We offer same-day social media delivery packages. Selected images are edited and delivered within hours during the event for real-time posting. This is especially popular for multi-day conferences that want to drive attendance and engagement.
Expect 75-100 edited images per hour of coverage. A full-day conference typically yields 500-800+ delivered images. We cull extensively and only deliver strong, usable images—not every frame shot.
Photo + Video Pricing
Elopement Photographer
Fort Collins Event Videographer Pricing
We create a detailed production schedule covering all sessions, develop daily highlight packages, and can deliver daily recap videos. Our crew rotates to maintain energy across long events. Multi-day packages include planning, coverage, and daily deliverables.
What to Expect from a Candid Studios Wedding Package
Fort Collins Wedding Photographer Pricing
What is included in your Fort Collins wedding photography packages?
Do you offer a second photographer for Fort Collins weddings?
Fort Collins Wedding Videographer Pricing
Elopement Photography
What to Expect from Your Engagement Session
Many couples also use the engagement session to test different photography styles — candid and documentary, editorial and posed, or a blend of both — so that by the time your wedding day arrives, we have already dialed in the exact approach that feels most like you. It is time genuinely well spent.
Fort Collins Engagement Photographer Pricing

## google reviews (top 3)
- (5★ 2026-02) Ryan and his team did an amazing job photographing our wedding. Tana was our photographer who showed up on time with a smile and dressed very nicely. Let me break it down.. 1st - we did everything ourselves decorated everything.So we were running late that day, and she jumped right in and didn't even bug us about what she should be shooting or where. swhoect. she just knew what to do which is very
- (5★ 2025-08) Candid Studios took amazing wedding photos for us in Fort Collins. The photographer got every feeling—laughter, sorrow, and happiness—just right. Their kind attitude made the day even better. We got our pictures immediately, and they were better than we had hoped. If you want wedding photos that will last forever and are full of emotion, I highly recommend this business in Fort Collins.
- (5★ 2026-04) Ryan photographed our wedding last year and he did such an amazing job! Not only were his photos incredible, but he is such a great person on top of that. He brought so much energy and creativity to our special day, we can't thank him enough for everything he did. 10/10, would absolutely work with him again. Thank you so much Ryan!!

=== PHOTOGRAPHER: Carissa Marie Photography | vendor_id=2b93d350-472a-4c20-a2d1-830d9935403a | bot=bot7 | date=6/2026 ===
# Carissa Marie Photography (Ouray) — vendor_id=2b93d350-472a-4c20-a2d1-830d9935403a
site=https://carissamarie.photo/ | google 5★ × 33

## site pricing/package lines
Carissa Marie Photography - Elopement Packages
About Me Info + Pricing Elopement Stories Education Contact
Contact Elopement Stories Education Info + Pricing
To take you from overwhelmed to a fully planned, meaningful elopement day, rooted in the significance of your marriage
Intimate Wedding & Elopement Photography Packages
I'll take you from feeling overwhelmed and unsure where to begin, to a fully planned, unique elopement day.
I provide customized assistance tailored to your unique elopement vision, from scouting the most incredible secret spot where you will say your vows, to helping you book the private Jeeping tour that will get you there.
7 years of experience specializing exclusively in elopement planning and photography
Custom elopement location ideas that are so beautiful they bring you to tears
With the same care and intentionality put into planning your elopement day. Because that's exactly what you deserve.
I'm here to give you the entire package.
With me you get a fully customized, elevated planning experience, but I'm more than just an elopement planner with a camera. I'm an artist, and I'm going to create art out of your adventure.
"My husband and I had already decided we wanted to elope in Kauai before finding Carissa, but we had no idea how we really wanted our elopement day to go.
"Carissa's magical work both inspired our wedding dreams, and brought those dreams to reality on our elopement adventure together."
"Early on in our engagement, my wife introduced me to Carissa's photography through one of her friend's elopement photos. Those photos took me to another world, through her surreal capture of environments and intimate moments which called to my soul.

## google reviews (top 3)
- (5★ 2025-02) Carissa, is everything you could possibly ask for for your elopement experience. She makes the planning process easy and intuitive while providing a caring, hands-on approach from the first email response all the way up to the day of the wedding. She was so eager to accommodate anywhere that she was able to, and allowed us to feel like we were in the driver's seat while providing her immense exper
- (5★ 2024-11) My husband and I were initially unfamiliar with the elopement process and didn't know exactly what to expect. But after our first Zoom call with Carissa, we immediately knew we had made the right choice. We had a few more meetings with her leading up to the big day where she helped us make a plan that fit our personalities and fine-tune the details, and her warmth, professionalism, and attention t
- (5★ 2025-10) Not enough words to describe how AMAZING Carissa is! Ever since our first chat, it was so easy to connect with her and build a friendship. She’s very detailed, helpful and her photography style is beautiful (our family and friends can’t believe the pictures are real!). I look back at the photos and feel like it’s my wedding day all over again. It was truly an unforgettable experience and I couldn’

=== PHOTOGRAPHER: Carl Bower Photographs | vendor_id=9d83ca07-64ea-473a-9c4f-561bb2fb2132 | bot=bot8 | date=2/2026 ===
# Carl Bower Photographs (Boulder) — vendor_id=9d83ca07-64ea-473a-9c4f-561bb2fb2132
site=https://carlbowerphotos.com/ | google ?★ × ?

## site pricing/package lines
What about prints, digital files, albums?
I have a flat fee of $4,000 for up to eight hours of coverage and the items mentioned above. Extended coverage beyond eight hours is $250/hour, but eight hours is almost always enough.
Rehearsal dinners or gatherings the night before are $1,000 for up to four hours.
I’ll put everything in a contract, which you’ll return with a deposit of $1,000 to hold the date.

## region pricing digests
- [launchintel] Carl Bower Photographs | $4,000 standard package, up to 8 hrs coverage, proof prints, online gallery, digital files; Pulitzer Prize finalist; unobtrusive black & white documentary style; small weddings and elopements | https://carlbowerphotos.com

=== PHOTOGRAPHER: Cassidy Cheyenne Photography | vendor_id=c7cb411b-5f47-4499-918e-ac1183921bfc | bot=bot9 | date=2/2026 ===
# Cassidy Cheyenne Photography (Durango) — vendor_id=c7cb411b-5f47-4499-918e-ac1183921bfc
site=https://cassidycheyennephotography.com/ | google 5★ × 33 | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-10) Cassidy was so amazing as our wedding photographer! We booked Cassidy for our welcome party and our wedding and I can not recommend her enough! My partner and I are both not very enthusiastic about getting our photos taken but Cassidy made it so fun and easy. We thought we would regret not doing a first look and having to take the time for photos after our ceremony but Cassidy made it quick and pa
- (5★ 2024-05) Cassidy is a dear friend of mine and has been for a few years now. She recently took photos and made a video of my wedding in early May. My biggest concern was my venue too small and not having enough spots for good pictures. Cassidy truly has a great eye and gave me more photos than I could’ve imagined. We also had a very windy and cloudy day on my wedding but you can’t tell at all in any of the 
- (5★ 2020-08) Cassidy was AMAZING! Both my husband and I felt truly comfortable working with her. We took engagement photos with Cass after we were engaged and we knew right away we wanted her to do our wedding too! She made every photo feel fun and authentic. On July 31st we had a covid wedding. The only thing I really wanted was great pictures to remember all the little details and to remember that no matter

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-04.csv
