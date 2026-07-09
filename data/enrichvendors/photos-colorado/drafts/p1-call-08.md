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


=== PHOTOGRAPHER: Janna Lynn Photography | vendor_id=874ff1b4-155a-41a7-8f01-a15ceefd41c4 | bot=bot4 | date=10/2025 ===
# Janna Lynn Photography (Durango) — vendor_id=874ff1b4-155a-41a7-8f01-a15ceefd41c4
site=http://www.jannalynnphotography.com/ | google 5★ × 20

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2020-02) We've used Janna for 2 newborn shoots, and 2 portrait shoots of 2 toddlers...my only complaint is trying to pick my favorite images is impossible! Janna is pure magic with kids and her photos are incredible - the lighting is perfect, she manages to take amazing photos of exhausted postpartum moms and make them look fresh and wonderful. She captures joy and the family effortlessly. Her photos are a
- (5★ 2018-01) Janna is seriously one of the most amazing and hardworking photographers in the county! We have been using her for my daughters photos since her birth. Janna was with me the whole 12 hours I was delivering and captured the most precious memories. She even came back the next day to ensure she got the best photos! My daughters two and hasn’t had her photos done by anyone else. She’s super versatile 
- (5★ 2020-02) We received a newborn session with Janna for or daughter as a gift from my family - and I am so incredibly glad to have captured those first few days with her like that! Janna was so gentle and patient with our kiddo - it is so apparent how much she loves her work and getting to photograph such a special time. We had so much fun, and the photographs are beautiful. Would highly recommend!

=== PHOTOGRAPHER: Jason and Daris | vendor_id=e2be146a-ab90-46e2-9841-5adcc586e842 | bot=bot5 | date=7/2025 ===
# Jason and Daris (Telluride) — vendor_id=e2be146a-ab90-46e2-9841-5adcc586e842
site=https://www.jasonanddaris.com/ | google 5★ × 30

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2024-07) Jason and Daris are incredibly talented photographers! We hired them for our engagement pictures last Fall and for our wedding last weekend (June), and although we haven’t gotten the photos back from the wedding yet, I can tell you that if they’re anything like the engagement photos, they’re going to be spectacular!! Jason is very professional and easy to work with. He goes above and beyond when f
- (5★ 2024-11) I can't speak highly enough about Jason and Daris. I honestly feel like this level of photography was way out of our league. Everything was so professional and fun. I don't consider myself to be very photogenic and I feel like somehow that was pulled out of me. It was very important to us that we get some good photos of our wedding. But I never could've imagined they would come out this good! I'm 
- (5★ 2024-05) Jason is an absolute rockstar behind the lens! From the moment we met, I knew we were in for something special. His talent is undeniable. Every photo turned out absolutely perfect. He did an incredible job of capturing our special day, and even took us out for an adventure session in the snow! Not only is he incredibly skilled, but he's also a joy to work with. His friendly and relaxed demeanor pu

=== PHOTOGRAPHER: Jenne Anne | Adventure Elopement & Intimate Wedding Photography | vendor_id=f3a42dae-c351-4ab4-a7f2-6304af399aba | bot=bot6 | date=10/2025 ===
# Jenne Anne | Adventure Elopement & Intimate Wedding Photography (Durango) — vendor_id=f3a42dae-c351-4ab4-a7f2-6304af399aba
site=https://jenneanne.com/ | google 5★ × 2

## site pricing/package lines
As a lifetime business owner, I spent years investing in personal development. Breathwork, neuroscience, and hypnotherapy certifications, coaching programs, masterminds. I was doing everything right. Something was always missing or falling away.

## google reviews (top 2)
- (5★ 2023-07) As a former wedding coordinator in Durango, I had the opportunity to work Jenne Anne on numerous occasions in Durango. She was always so organized, personable, and delivers beautiful work to her clients. She is fantastic at coordinating/communicating with venues and clients, timely, and a wonderful vendor to work with on the day of your event. I would absolutely recommend Jenne Anne!
- (5★ 2023-10) She really took the time to understand what I wanted and offered great suggestions. I highly recommend her - she is professional, insightful, and produces amazing results. 5 stars for sure!

=== PHOTOGRAPHER: Jennifer Garza Photography | vendor_id=067b861d-7a5a-4d76-8d0f-e26358e3d7a6 | bot=bot7 | date=4/2026 ===
# Jennifer Garza Photography (Commerce City) — vendor_id=067b861d-7a5a-4d76-8d0f-e26358e3d7a6
site=http://www.jennifergarzaphotography.com/ | google 4.9★ × 22

## site pricing/package lines
Colorado Wedding & Portrait Photography Investment | Jennifer Garza Photography
COLORADO & DESTINATION WEDDING PHOTOGRAPHY INVESTMENT
Now Booking 2026 Weddings & Elopements!
Featured Colorado Weddings & Engagement Sessions
Rocky Mountain National Park Summer Elopement
Loveland Pass Summer Elopement
Summer Engagement Session at The Denver Botanic Gardens
Fall Engagement Session at Lost Gulch Overlook &#038; Chautauqua Park
Engagement Session at Sweet Cow Ice Cream &#038; Davidson Mesa
Let's spend time doing something you love. Like going bowling, grabbing a drink at a local brewery, or hanging with your "fur babies." This is not your typical engagement session.
Anne & Josh's Rocky Mountain National Park Summer Elopement
Jenni & Mike's Loveland Pass Summer Elopement

## google reviews (top 3)
- (5★ 2021-01) Jennifer Garza was an amazing wedding photographer and did an excellent job at capturing our day. She put in the extra time and effort up front to make sure we had a solid plan and had back-up location plans for things like our first look and family shots. She was calm and collected with us during the hectic getting ready morning, and made sure we were staying on-schedule. She did a great job wran
- (5★ 2026-02) She does great work and is really friendly. Her website does have more of a wedding photo vibe, but don't discount her based on that. We did family photos with absurd wind and the photos still came out great! She is also very flexible. We showed up on the originally scheduled day and it was overcast and sprinkling and she was really cool about rescheduling. She is definitely in it for the craft! 1
- (5★ 2019-12) Jennifer Garza is THE wedding, family and senior photographer for your family's needs. She is prompt with communication, professional at all times, and makes you so relaxed when taking pictures. She takes all the stress out and just lets you have FUN! I will be using her for all of my family's special occasions!

## region pricing digests
- [launchintel] Jennifer Garza Photography | $3,500 starting; documentary wedding photographer since 2014; classic + photojournalism blend, bold colors; serves Colorado and Rocky Mountains, travels nationally/internationally; also offers family/maternity/headshots/senior | https://www.jennifergarzaphotography.com

=== PHOTOGRAPHER: Jennifer Glenn Photography | vendor_id=29a30efb-ffd7-43c3-8dd8-f5557dc13835 | bot=bot8 | date=7/2025 ===
# Jennifer Glenn Photography (Golden) — vendor_id=29a30efb-ffd7-43c3-8dd8-f5557dc13835
site=https://www.jenniferglennphotography.com/?utm_source=google&utm_medium=wix_google_business_profile&utm_campaign=15290998387275197984 | google ?★ × ?

## site pricing/package lines
All of my wedding packages include:
Mini engagement session
Second Shooter may be added for an additional additional $200 per hour

=== PHOTOGRAPHER: Jess Bidwell Photography | vendor_id=5fb45186-d1d9-44e8-8ee2-995c8956000f | bot=bot9 | date=4/2026 ===
# Jess Bidwell Photography (Montrose) — vendor_id=5fb45186-d1d9-44e8-8ee2-995c8956000f
site=http://www.jessbidwell.com/ | google 5★ × 41

## site pricing/package lines
Colorado Photographer | Families, Couples, Seniors & Elopements
Senior sessions are $300 for a one-hour session.

## google reviews (top 3)
- (5★ 2025-12) We had the pleasure of working with Jess while she captured our engagement photos, and she did a wonderful job! She made us entirely comfortable right off the bat, and the final photos turned out better than we could imagine! We will definitely be using her services in the future. I would 100% recommend Jess for any of your photography needs.
- (5★ 2026-01) Jess is a master of her craft and certainly an artist. She not only captured the aesthetic beauty of our handcrafted mobile sauna, her approach and angle helped us understand more deeply how we wanted to present Fire Within Sauna to the Western Slope of Colorado. Thank you for your flexibility and creativity, Jess!
- (5★ 2025-11) We loved working with Jess! Even though the weather wasn’t ideal, she managed to capture beautiful photos that we absolutely love. She made the whole experience fun and easy, and we received our photos back so quickly. Highly recommend to anyone looking for a great photographer in Colorado!

=== PHOTOGRAPHER: Jessa Rae Photography Crested Butte, Colorado | vendor_id=2b3f3b9d-6350-4221-ba0f-69837e745858 | bot=bot10 | date=2/2025 ===
# Jessa Rae Photography Crested Butte, Colorado (Gunnison) — vendor_id=2b3f3b9d-6350-4221-ba0f-69837e745858
site=http://www.photographyinthemountains.com/ | google 4.9★ × 30

## site pricing/package lines
Love the Crested Butte venues in this list, but still not 100% sold on Crested Butte? See 5 reasons why I think Crested Butte is the best place for your elopement or wedding here .
We&#8217;d love to learn more pricing and confirm availability.
What a great insight into this location! It is stunning, and even more exciting that it has all the features you mentioned. It&#8217;s like being able to get the location of a small elopement, with the amenities of a large wedding! Thanks!
Investment - Pricing
I seriously get so excited for you and for the magic we create in your images. That feeling motivates me to dig right into editing your photos and sending over a sneak peek of at least 25 images within 5 days of your elopement/wedding/session!
Elopement/Micro Wedding
Full elopement planning, including location suggestions, custom timeline help, assistance with permits, and vendor recommendations.
A complimentary engagement session included with all full day packages
Jessa Rae Photography | Crested Butte elopement photographer
Elopement and Wedding Photography.
About your Crested Butte elopement & wedding photographer
Here are a few reasons why I think Crested Butte is THE BEST place in Colorado to have your elopement wedding:
2. I am always up for a good hiking adventure, but not everyone wants to hike on their wedding day. That is perfectly OK. Crested Butte has amazing places for you to elope without ANY hiking. I plan whole elopement days for people, exploring all over the mountains, with zero hiking involved.

## google reviews (top 3)
- (5★ 2024-06) I was absolutely jaw-dropped when Jessa sent me our engagement photos. She is incredible! Not only are her photos literally out of a dreamy magazine, but she is also so great to work with. My finance and I wouldn't consider ourselves photogenic in the slightest, but Jessa did a wonderful job walking us through the session and how/where to stand, etc. She is a kind individual who made us feel like 
- (5★ 2024-09) Jessa did our wedding photos this past July and was absolutely amazing. My husband and I hate doing photos and are not photographic and she made us feel so comfortable and captured amazing shots. I wanted lightly edited pics with mountains, water and wildflowers and she was able to capture exactly what I wanted.
- (5★ 2026-02) Jessa is incredible! 🌟 We recently travelled to elope in CB in October, and had picked out a few viewpoints for our photos ahead of time. The day of, after some previous snowfall that had melted and washed out some of the roads, we had to make some last minute adjustments. Jessa took the time to scope out the road conditions the morning of, and came back with some suggestions for alternative loca

=== PHOTOGRAPHER: JMGant Photography | vendor_id=0c18172e-14f4-4fa5-91d1-132e9526e976 | bot=bot11 | date=7/2025 ===
# JMGant Photography (Greeley) — vendor_id=0c18172e-14f4-4fa5-91d1-132e9526e976
site=https://www.jmgantphotography.com/ | google 4.9★ × 81

## site pricing/package lines
Price List &mdash; Colorado Wedding Photographer | JMGant Photography | Jared M. Gant
Wedding Package Pricing
✔ Up to 12 Hours of Coverage
✔ Classic Engagement Session
✔ Up to 8 Hours of Coverage
Holidays and holiday weekends are reserved for Unlimited packages only.
Party Booth | $300/hour (2 Hour Min)
Party Booth Props and Backdrop | $300
Aditional Album Photos | $30/ea
Stand Alone Hourly | $850
Additional Package Hourly | $600
Second Photographer | $250/hour (3 Hour Min)
Adventure Engagement | $1800
Classic Engagement | $900
We believe in print. We also believe that there is no better way of telling your wedding day story than through our heirloom albums. An album allows you to relive the entire wedding story. This heirloom piece will be cherished not only for your lifetime but for generations to come.
Pricing starts at $600-$1000
Pricing ranges from $300 and up
Indian and Desi Wedding Pricing
Desi weddings can vary greatly and often do not fit the standard package pricing.
Heirloom albums and wall art
We believe your photos deserve to be seen in print. For that reason, we have partnered with the world’s greatest print labs, offering the finest heirloom albums and an array of wall art collections. Don’t let your photos just live on your computer.
Great Sand Dune National Park Engagement Session by Colorado Photographer | Amy+ Brice
Rocky Mountain National Park elopement photographed by Estes Park photographer JMGant Photography - Mikenzie and Adam
Winter Engagement Session | Estes Park Wedding Photographer | Diana and Jonathan

## google reviews (top 3)
- (5★ 2019-08) Words cannot express our gratitude for Jared and his work. From beginning to end he was extremely professional, fun and transparent. Leading up to our wedding, Jared really took the time to get to know us, our vision for the day and things we like/don’t like – no detail was left undiscussed. All of that prep led to the most authentic, fun, beautiful and detailed photos we have ever seen. Those tha
- (5★ 2020-09) If I could give Jared 10 stars I would. I wanted this photographer the minute I saw his website and when I showed my husband (fiance at the time) he was 100% on board. Since we moved to another state for work most of the meetings were virtual (even pre covid) so that was extremely helpful. Super professional and well organized. His emails to prepare for the big day were super helpful. When the ven
- (5★ 2024-09) If you are looking for a sign to book JMGant Photography, this is it! Jared was AMAZING!!! Our wedding was three years ago and people are still talking about our photographer. Jared’s communication was exceptional from the start and it remained strong through the whole process. He was very organized and kept our wedding running smooth. So organized that we ended up using his schedule and timeline

=== PHOTOGRAPHER: Joe and Robin Photography | vendor_id=9472f3d8-1b90-4bba-89f7-68495579584b | bot=bot12 | date=6/2025 ===
# Joe and Robin Photography (Littleton) — vendor_id=9472f3d8-1b90-4bba-89f7-68495579584b
site=https://joeandrobin.com/ | google 5★ × 144

## site pricing/package lines
Long Lake Elopement | September

## google reviews (top 3)
- (5★ 2026-04) 10/10 experience with Joe and Robin! As the one who was getting proposed to, Joe made me feel so comfortable in front of the camera. He gave us the space to be ourselves, completely capturing the moment. Nothing felt forced! Robin did an amazing job editing our photos and in return, we received about 80 pictures, some in black and white too. It didn't seem like anything was missing from that day a
- (5★ 2025-08) Joe and Robin are absolutely incredible photographers. Joe was our photographer for our wedding day, and the photos are absolutely incredible, and I can’t stop looking at them. He captured the day as it unfolded, and the photos tell the story of the day. When I look at the photos it feels like I am reliving my wedding day. He did an amazing job of capturing the little moments, and none of our phot
- (5★ 2025-08) Joe and Robin were nice, fast, knowledgeable, and helpful. We got engagement, and wedding photos and both times they helped with best times for certain locations and tips and tricks for each location. I felt like they weren’t just photographers for our events, they were also like planners, and willing to help. They helped us a lot during our wedding day, and also returned the photos extremely fast

=== PHOTOGRAPHER: Joe Pyle Photography | vendor_id=4b09d03a-973f-475e-bd9e-95c098d18b38 | bot=bot13 | date=1/2026 ===
# Joe Pyle Photography (Estes Park) — vendor_id=4b09d03a-973f-475e-bd9e-95c098d18b38
site=http://www.joepylephotography.com/ | google 4.9★ × 59

## site pricing/package lines
Pricing for 2026 : Pyle Photography
Our Pricing Guide for 2026
FREE ENGAGEMENT SESSION WITH OUR SIX HOUR AND ABOVE PACKAGES
TWO LEAD PHOTOGRAPHERS - No assistants, no second shooters, no "associates", and no photos missed!
Travel to exotic places, have your elopement, and live your dreams!
Complimentary Engagement Session Included With Weddings of Six Hours or More
If this doesn't fit within your wedding budget, don't hesitate to get in touch. We can customize a package for you.
We'll send you a follow-up email to recap our conversation, including a contract and invoice for you to look over. We'll answer any additional questions and if you're ready to secure your date with us, we require only a 30% retainer.
When we receive your contract and retainer, we'll secure your date on our calendar. This is when we'll start to talk about timelines, logistics, and share some of our local expertise.
If you have questions about RMNP or having your wedding or elopement in the area, don't hesitate to reach out for a no obligation consult.
If you’re planning a wedding or elopement near RMNP, we’d love to help as your RMNP wedding photographer team.
- A romantic, adventure-friendly setting for elopements and weddings
3.  Rocky Mountain National Park  (RMNP): For adventure-loving couples, RMNP offers stunning locations for elopements and intimate ceremonies.
3. Pay the $30 marriage license fee.
Winter elopements in Estes Park and RMNP are wildly underrated. Town has become calm, RMNP is beautiful, and the locals come out to play! Snow-covered peaks, frozen lakes, and quiet trails create an intimate, almost cinematic atmosphere.
pdf rate cards seen on site (not fetched): https://www.joepylephotography.com/wp-content/uploads/2026/05/estes_park_wedding_timeline_guide2.pdf

## google reviews (top 3)
- (5★ 2025-07) Working with Joe and Kari from Joe Pyle Photography was one of the most joyful and effortless parts of our wedding day. From the very first meeting, they felt less like vendors and more like longtime friends—warm, genuine, and completely invested in capturing our day in the most meaningful way. Throughout the day, they went above and beyond—helping with trains and veils, checking in to make sure w
- (5★ 2021-12) I cannot rave enough about how amazing Joe and Kari were on our wedding day. We had a small wedding with 32 people and Joe and Kari fit right in. Having them feel like family only made our session that much more special. The professionalism, kindness, and fun that came with hiring Joe Pyle Photography was out of this world. Leading up to our wedding Joe was always just an email or text away. Every
- (5★ 2021-11) If you are seeking exceptional photography and a wonderfully unique experience for your special occasion, look no further! Joe & Kari are the perfect duo and exceeded all expectations on our wedding day (October 13, 2019) and 2 year anniversary. We love the outdoors and were so fortunate that we could get married in the breathtakingly beautiful, Rocky Mountain National Park. We wanted two people w

## region pricing digests
- [launchintel] Joe Pyle Photography | $3,400 starting per WPJA; husband/wife team (Joe + Kari Pyle), full-time since 2013, 400+ weddings/elopements/engagements; two lead photographers at every wedding; venues include Black Canyon Inn, Della Terra, The Stanley Hotel, Romantic Riversong, Taharaa, YMCA of the Rockies

=== PHOTOGRAPHER: Jolie Rodriguez Photography | vendor_id=c8096a7f-a97a-414a-804d-28e7d87782d8 | bot=bot14 | date=6/2026 ===
# Jolie Rodriguez Photography (Parker) — vendor_id=c8096a7f-a97a-414a-804d-28e7d87782d8
site=https://jolierodriguezphotography.com/ | google 5★ × 86

## site pricing/package lines
View more engagement sessions
Hey there, nice to e-meet you! My specialty in photography is elopements and weddings. I remember being asked as a five-year-old what I wanted to be when I grew up, and I said, “an artist!”
Beautiful boutique packaging
Join us at Bingham Lake on May 2–3 for a beautiful, limited-time portrait experience. Sessions are just $89 — spots are filling fast!
Hello! Ever since my dad gave me a camera and a roll of Kodak film as a child, I have loved photography! From developing black & white pictures of friends in the darkroom in England to making family albums from travels around the world, I cherish the memories captured by my cameras over the years.
ELOPEMENTS & WEDDINGS

## google reviews (top 3)
- (5★ 2026-06) I've worked with Jolie for years and have done family and maternity photo sessions with her. Most recently, I had headshots taken, and as always, I was not disappointed. She is professional, flexible, and incredibly easy to work with. Her attention to detail is outstanding, and she has a way of making you feel completely comfortable in front of the camera. She guides you through the entire process
- (5★ 2026-01) I would highly recommend Jolie Rodriguez photography! Jolie was very easy to work with, and our photo shoot was relaxed, enjoyable, and efficient. Her process for selecting photos was simple, and she replied to my questions rapidly. And the final images were PERFECT! She did professional head shots for me, but I'd recommend her for any type of photo needs; I'll bet she'd be great (and fast!) with 
- (5★ 2026-01) Jolie is such a breath of fresh air & takes the stress out of capturing family photos. She’s very laid back, but captures the beauty of nature & families with ease & professionalism. She was very patient in the photo selection process & is worth every penny for the priceless photos you will enjoy for years to come! Don’t keep looking; she’s the best!

=== PHOTOGRAPHER: Jules Kennedy Photography | vendor_id=e98a1afe-2b08-43b6-a286-26f614b1611e | bot=bot15 | date=5/2025 ===
# Jules Kennedy Photography (Fort Collins) — vendor_id=e98a1afe-2b08-43b6-a286-26f614b1611e
site=https://www.juleskennedyphoto.com/ | google 5★ × 50

## site pricing/package lines
Investment &mdash; Jules Kennedy Photography
*Intimate Weddings of 15 people or less begin at $3400
*Mini Sessions will be offered seasonly at a discounted price - spots are limited
South Valley Park Engagement Session - Littleton, Colorado | Ashley & Brandon
Roxborough State Park Engagement Session | Aleah & Ryan
Lost Gulch Colorado Engagement Session | Claire & Joe
Newfields Indianapolis Engagement Session | Miranda & Barret
The Experience & Investment &mdash; Jules Kennedy Photography
I’m currently based out of Denver, CO, but I absolutely love to travel! All my packages include cost of travel and accommodations so you don’t have to worry about any additional fees.

## google reviews (top 3)
- (5★ 2025-12) My husband and I had the best experience working with Jules. We are not naturally very comfortable in front of a camera and Jules somehow managed to capture the most beautiful photos I ever could have hoped for for our wedding. Not only is she exceedingly talented, she was a joy to spend time with. She has an incredibly warm and grounding presence and truly added to our wedding experience. I canno
- (5★ 2024-05) Jules is quite literally the most talented photographer I’ve ever known. We’ve worked with her for my wedding back in 2021 and for my newborn/family photo shoot in 2024, and both times we were blown away with the photos! Jules pours her heart and soul into her craft and delivers images that are raw with emotion, unique/earthy in style and just simply stunning. And she is kind, patient and lovely t
- (5★ 2025-12) We had such a great time with Jules for our photoshoot. She made both me and my wife feel so comfortable and at ease the entire time, and our photos turned out incredible. We’re so grateful for the memories, she captured us so well with photos we'll cherish. We highly recommend her to anyone looking for an amazing photographer!

=== PHOTOGRAPHER: Julien Kibler Studio | vendor_id=0f2b726a-2d40-4278-a9e1-f803863c291f | bot=bot16 | date=2/2026 ===
# Julien Kibler Studio (Montrose) — vendor_id=0f2b726a-2d40-4278-a9e1-f803863c291f
site=https://julienkibler.com/ | google 5★ × 138

## site pricing/package lines
Whether you’re dreaming of a sunrise elopement at Blue Lakes or a grand celebration in Ouray’s historic downtown, each wedding carries its own unique spirit.
Trustindex verifies that the original source of the review is Google. My fiancé and I can not express out gratitude and happiness we experienced during our special engagement proposal along with an afternoon engagement session. Every moment of this surprise engagement was captured.
A full-service package for weddings and elopements
Absolutely! I regularly photograph weddings throughout Western Colorado’s mountain venues. Travel fees are included for locations within the San Juan Mountain region.
Do You Hold Our Date With A Retainer?
Yes, a 50% retainer and signed contract secures your date, with the balance due 30 days before the wedding. All packages include pre-wedding consultation and timeline planning.
Elopement Photography
Elopement Photos | Elopement Photos | Elopement Photos | Elopement Photos | Elopement Photos | Elopement Photos | Elopement Photos | Elopement Photos |
The mountains are nature’s cathedral, your love writes the story. Here’s how we craft your perfect elopement day:
Some couples choose sunrise on a mountain peak, others prefer sunset in a hidden valley. Each elopement reflects the unique way you’ve chosen to begin your journey together.
My intimate knowledge of these peaks means knowing exactly where to be when the light turns magical, ensuring your elopement photos are as extraordinary as your choice to celebrate your way.

## google reviews (top 3)
- (5★ 2025-12) Julien is absolutely incredible. His professionalism, gentle spirit, fun nature, and expertise greatly contributed our wedding day being seamless. Julien knew exactly what to do to accomplish perfect lighting for our gorgeous photos. I have never felt more beautiful. We were amazed by our same day sneak peaks and couldn’t wait to see the rest. I’m beyond grateful we trusted Julien with our special
- (5★ 2026-01) I recently had Julien cover our proposal in Telluride, and I could not be happier with how everything turned out. From the start, he was prompt, friendly, and extremely professional. He made the entire process feel easy and even gave advice on other aspects of planning the trip which was very helpful. Julien was also excellent at suggesting locations and timing. He suggested a different time than 
- (5★ 2026-06) I had never been Telluride before and thought it would be a great place to propose. I contacted Julien, and he gave me several options of engagement spots and helped map out the whole proposal plan. Julien captured the proposal perfectly against an amazing backdrop. He did a great job of staying discreet and keeping the moment private and a surprise. Julien also did a great job directing poses for

=== PHOTOGRAPHER: Justin Edmonds Photography | vendor_id=7121747e-e069-48d7-8036-35fcd215721f | bot=bot17 | date=7/2025 ===
# Justin Edmonds Photography (Denver) — vendor_id=7121747e-e069-48d7-8036-35fcd215721f
site=https://www.jcedmonds.com/ | google 5★ × 47

## site pricing/package lines
Real weddings don&#8217;t fit neatly into four, six or even eight hour packages. Our collections don&#8217;t require you to know your timeline months before your wedding.
As a documentary photographer, I crave moments. And it turns out a lot of moments happen before most photographers arrive or after they leave. That&#8217;s why all of our collections include full day coverage!
Wedding collections start at $5200 and always include:
&#8211; full day coverage with two photographers
Colorado Wedding Photography Packages - Justin Edmonds Photography
11:30am &#8211; Getting Ready (Justin and second photographer arrive)
Assistance with wall art and photo albums
what is included in the collections?
everything from the base collection
everything from premium collection
Weddings on peak dates and holidays and weddings with extensive travel (usually involving flights or hotel stays) may be priced higher. Contact us for detailed pricing information.
CHECK PRICING & AVAILABILITY
When you&#8217;re ready to book your date, I&#8217;ll send a digital invoice and agreement. You can pay the booking fee ($1,500) via secure online payment system. The balance is due 30 days before your wedding date.
&#8220;Justin ran the show, made us all at ease and was such a great communicator. When you hire Justin you&#8217;re hiring a hell of a lot more than a photographer. He&#8217;s the full package!”
featured engagement sessions

## google reviews (top 3)
- (5★ 2024-05) Justin isn't just a photographer; he's a magician wielding a camera, turning moments into memories that dance off the pages of our wedding album. From the first consultation to the final click of the shutter, Justin's dedication to his craft was evident. He meticulously planned every detail, ensuring our day flowed seamlessly despite the looming threat of rain at Arapahoe Basin. On our wedding day
- (5★ 2023-01) Its hard for me to summarize just how amazing Justin is and that working with him was the absolute highlight of my wedding. From taking the time to meet us to get to know who we are as people and our story, to working seamlessly with the various wedding vendors, we knew Justin would capture the vision and spirit of our wedding and not just 'take pictures.' To say Justin went above and beyond is an
- (5★ 2026-05) We booked Justin for our September 2025 wedding at Winter Park and are absolutely blown away by his incredible work. There are many wedding photographers to choose from, but Justin stands out among them all. His unparalleled skill, professionalism, attention to detail, and dedication to his craft was clear from the very beginning and his mastery truly shines in all the images from the day that wil

## region pricing digests
- [launchintel] Justin Edmonds Photography | $5,200 starting; 3-tier collections (base/premium adds engagement session/luxury adds engagement + custom book); documentary photojournalism; serves Denver, Vail, Breckenridge, Keystone, Aspen, Boulder and Rocky Mountain region; ex-Getty/NYT/Sports Illustrated photojourn

=== PHOTOGRAPHER: Justyna E Butler, Colorado Elopement Photographer | vendor_id=48158314-9efb-431c-9e32-a025b8175ff1 | bot=bot1 | date=2/2026 ===
# Justyna E Butler, Colorado Elopement Photographer (Highlands Ranch) — vendor_id=48158314-9efb-431c-9e32-a025b8175ff1
site=https://www.justynaebutlerphotography.com/ | instagram=@justynaebutler | google 5★ × 17

## site pricing/package lines
Justyna E Butler I Colorado Elopement Photographer
How to Elope in Colorado | Elopement Planning Guide
Ultimate Hiking Guide to Winter Adventure Elopements in Colorado
Colorado Adventure Elopement Timeline Ideas (Full-Day, Half-Day & 2-Day Experiences)
Colorado Elopement Photographer
Colorado Elopement Photography
Moody & Cinematic HIKING ELOPEMENTS, SUNRISE CEREMONIES, AND MULTI-DAY ADVENTURE WEDDINGS IN COLORADO & WORLDWIDE
ROCKY MOUNTAIN NATIONAL PARK COLORADo ELOPEMENT PHOTOGRAPHY FOR COUPLES SEEKING INTENTIONAL & OUTDOOR WEDDING EXPERIENCe.
WHEN THE BIG WEDDING WASN't for you, Your elopement isn’t just a ceremony—it’s a story that unfolds across landscapes, light, and emotion.
Elope with purpose, dive into adventure, and honor your love in a way that is unmistakably yours and truly unforgettable. My Colorado elopements enchant couples with their profound intimacy and cinematic flair.
WHY COUPLES CHOOSE ELOPEMENT INSTEAD OF A TRADITIONAL WEDDING
What does an adventure elopement actually FEEL like from start to finish?
MEET YOUR COLORADO ELOPEMENT PHOTOGRAPHER
COLORADO-BASED AWARD-WINNING ELOPEMENT & INTIMATE WEDDING PHOTOGRAPHER
Inspired by light, movement, and  windswept storytelling , I'M JUSTYNA, COLORADO ELOPEMENT & INTIMATE WEDDING PHOTOGRAPHER. By light, movement, and windswept storytelling, I’ve spent 14 years capturing over 500 love stories in the Rocky Mountains and around the world.
About your Elopement Guide, Justyna
Why Choose Me as Your Colorado Elopement Photographer
Elopement Planning resources & GUIDES

## google reviews (top 3)
- (5★ 2024-09) Justyna is truly exceptional. We booked her to photograph our wedding in the summer of 2023. Not only is she a phenomenal photographer who captured the most beautiful moments, but she's also an incredible person. When I called her, so stressed, and crying about planning our elopement, she listened patiently and invited me to sit down with her the very next day. There, she helped me create a detail
- (5★ 2025-09) Justyna is a fantastic photographer! My new husband and I booked her for both our engagement shoot and our wedding day. We are not usually very comfortable in front of a camera, but Justyna has such a warm personality that helped us both relax. On our wedding day, she helped keep us grounded whenever we felt stressed, while staying well organized and on time. Most importantly though, all our photo
- (5★ 2024-09) We booked Justyna for our engagement photos in 2018 and wedding in 2019 and could not recommend her enough! We wanted a photographer who could capture our shared love for adventure, of the mountains, and whose photos didn’t feel stiff, and the moment we found her website we knew she was the photographer for us. Justyna met us in RMNP at 4am before sunrise full of energy. She is super friendly and

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-08.csv
