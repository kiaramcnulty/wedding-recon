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


=== PHOTOGRAPHER: Castlehouse Videography | vendor_id=2ee73e50-7618-47c8-ae08-e881d9d25710 | bot=bot10 | date=8/2025 ===
# Castlehouse Videography (Boulder) — vendor_id=2ee73e50-7618-47c8-ae08-e881d9d25710
site=https://www.castlehousevideography.com/ | google 5★ × 27

## site pricing/package lines
Colorado Elopements | Elopement Photographer & Videographer
COLORADO ELOPEMENTS FOR NATURE LOVING ROMANTICS
Full service Colorado elopements: planning, photography and videography
We’re Mal & Roo ~ an elopement planning photo and video team based in Colorado. We’re partners in life and on the trail! We’ve built Castlehouse to help couples like you craft and capture unforgettable Colorado elopement days outdoors.
ELOPEMENT RESOURCES!
Finding Your Perfect Elopement Wedding Dress
Castlehouse Videography is a Colorado elopement photographer, videographer, and planning team helping nature-loving couples document and plan intimate adventure elopements across Colorado.
How to Choose the Perfect Elopement Wedding Dress &mdash; Castlehouse Videography
How to Choose the Perfect Elopement Wedding Dress
Your elopement day should feel easy, intentional, and completely yours, from the views you choose to the outfit you wear.
This lil’ dress guide walks you through how to find a dress that’s beautiful, functional, and true to your style. So you can feel incredible and totally at ease on your elopement day.
Before thinking about fabric or silhouette, take a step back and go big picture. Imagine your elopement day.
Check out this elopement video we crafted for a couple who chose to hit the slopes on their big day! Notice how she can do all things in her dress :-)
Here’s the tea: you can have an elopement wedding dress that’s stunning and lets you move freely. We've seen countless brides ditch stiff corsets or huge ballgown skirts in favor of dresses they have better mobility in.

## google reviews (top 3)
- (5★ 2021-11) Hiring Roo of Castlehouse Videography was the best decision my husband and I made after picking to Elope in Colorado. My husband and I got engaged in January and wanted a late April wedding. Being a wedding planner professionally, I know what is typically possible to pull together in that timeframe while also having extremely high standards. From our first call, Roo made me feel like getting marri
- (5★ 2022-03) Working with Roo for our elopement day was incredible from start to finish! He was communicative and reached out early when we first contacted him. We set up a call right away so he could get to know us and tell us about the process. Roo is a creative genius and let us be part of the process by suggesting some new ideas to make our video even better. We had a brainstorming call with him and did so
- (5★ 2026-06) Unbelievable photos, incredible elopement planning! From the moment we hired them, Mal and Roo presented us with several breathtaking locations for our ceremony, and helped us pick a place that was perfect for us. We were particularly impressed with the planning, and how well they kept to our schedule for the ceremony, a shoot with family, and individual photos, and made sure we were on time for o

=== PHOTOGRAPHER: Catherine Norwood Denver Wedding Photographer | vendor_id=18069a93-e1b0-40b8-ad46-0911ecb1ae1c | bot=bot11 | date=6/2025 ===
# Catherine Norwood Denver Wedding Photographer (Denver) — vendor_id=18069a93-e1b0-40b8-ad46-0911ecb1ae1c
site=https://www.catherinenorwood.com/ | google 5★ × 45

## site pricing/package lines
DENVER Wedding Photography Packages
Wedding photography pricing varies based on location, coverage length, and how much of the day you’d like documented.
60 Minute Complimentary Denver Engagement Session
Classic Coverage - $6100
1 Second Photographer - For 5 Hours
90-Minute Complimentary Denver Engagement Session
Weekend Coverage - $8500
1 Second Photographer - 12 hours
90-Minute Complimentary Engagement Session
Colorado Mountain Engagement Session Travel (the rest is complimentary with any 6+ hour package) - $300
Boudoir (couple or solo) Session - $800
Rehearsal Dinner Coverage - $1000
GET THE FULL PRICING GUIDE
You’ll receive about 75 -100 edited images per hour of coverage. Each gallery is curated to reflect your story.
Do you offer elopements?
Yes! Elopement photography starts at $1250 for weekday elopements within 30 minutes of Denver and includes 90 minutes of photography. Elopements include around 5-10 guests. Elopements under 6 hours are unavailable on Saturdays and most Fridays and Sundays, May - October.
Do you offer albums or prints?
Yes. You can order albums and high-quality prints directly from your gallery. I’m happy to help design albums if you’d like something custom. Wedding albums start at $700 and family wedding albums start at $500. Receive $100 off/album when purchased upfront with your wedding photography.
A nonrefundable retainer is required to secure your wedding date. The remaining balance is split into 2-3 payments before your wedding. Your contract will outline rescheduling and cancellation policies in full.

## google reviews (top 3)
- (5★ 2026-02) We were so happy we worked with Catherine for our engagement photos and then for our wedding in Fort Collins in September! From our very first conversation to receiving our final gallery, everything was seamless and professional. Catherine made us feel completely comfortable in front of the camera, and truly captured the joy and emotion of our wedding day. The photos are beyond stunning — every im
- (5★ 2026-01) We are live musicians who had the pleasure of working alongside Catherine Norwood Photo for a wedding in Fort Collins, Colorado. Catherine was fantastic and friendly and brought a calm, professional energy that kept the wedding running smoothly. As musicians, we're often in the background during key moments, and we got to observe Catherine's ability to effortlessly float around without being intru
- (5★ 2025-12) Catherine is simply the BEST! She took the most stunning photos and was so easy and fun to work with. She has a really easy to understand process when figuring out all of the logistics and takes the stress out of planning! The photos we got are so, so, so beautiful and she did the perfect job capturing the essence of what we loved about our wedding. Neither my fiancé or I are super photogenic or c

=== PHOTOGRAPHER: Clyde Plasencia Photography | vendor_id=beff527e-01d2-40f8-ba52-2ad5aab3e79a | bot=bot12 | date=4/2026 ===
# Clyde Plasencia Photography (Boulder) — vendor_id=beff527e-01d2-40f8-ba52-2ad5aab3e79a
site=https://clydeplasencia.com/ | google 5★ × 15

## site pricing/package lines
Pricing | Colorado Wedding Photographer | Clyde Plasencia
a look at pricing and process
from all day adventures to overnight elopements
Colorado wedding packages
Elopements by they're very nature are non-traditional and not uniformed. these days come in all forms and sizes. Whether you're planning on a small, short ceremony with couple's photos afterwards, or an multi-day trip, this journey is about creating images and a plan that fit you.
Here's what an elopement with me looks like...
Unless you're booking a multi-day elopement that will require lodging, I do not charge any travel fees in within the state. If we're looking out of state, I only charge the cost of travel itself - nothing more!
No Travel Fees in the State of Colorado
Film photography has always been a passion of mine, which is why I include a minimum of 3 rolls of film for every elopement. This can be color or black and white, 35mm or medium format
Regardless of the amount of time booked, each of my elopements include the following:
Half day elopements are perfect for couples who elope with only themselves and a few guests. 4 hours of coverage gives us enough time for glimpses of getting ready, the ceremony itself, and time for couple's photos - all while giving us a bit of wiggle room for travel throughout the day
half day - 4 hours of coverage
Full day elopements give you the opportunity for longer hikes, outings, or activities to fit into your wedding day without feeling rushed or hurried. If you're looking to document your wedding day from the Getting Ready process to the end of an intimate dinner, this is the way to go!

## google reviews (top 3)
- (5★ 2025-06) We had the absolute pleasure of working with Clyde as our wedding photographer, and he was truly amazing! From the very beginning, he was so easy to work with—professional, friendly, and attentive to every detail. He really took the time to listen to what we wanted, and the results were better than we ever expected. The photos are stunning and perfectly capture the joy and emotion of our day. Ever
- (5★ 2025-06) As someone who researches EVERYTHING, I feel like we hit the jackpot in hiring Clyde for our wedding. He went above and beyond in every aspect, from the planning process to the day of our wedding. He’s professional, talented, and just an overall great person. When reminiscing on our day, family and friends often mention “how great our photographer was”. Searching for wedding vendors can be overwhe
- (5★ 2025-06) We had the best experience working with Clyde for our Wedding in Salida, CO last June. Our pictures turned out so amazing and he made the process so smooth and easy, it was like working with a close friend. Our beautiful rainy day was captured perfectly, even ending with a rainbow. We couldn’t recommend him enough, in fact our close friends already booked him for their wedding in September! Thank

=== PHOTOGRAPHER: Colorado Wedding and Elopement Officiant Julie Adriansen | vendor_id=e6647afc-9d56-4fb0-b708-a2989bd78535 | bot=bot13 | date=2/2026 ===
# Colorado Wedding and Elopement Officiant Julie Adriansen (Vail) — vendor_id=e6647afc-9d56-4fb0-b708-a2989bd78535
site=https://www.julieadriansenart.com/weddings | google 5★ × 16

## site pricing/package lines
Signature Furniture & Original Art Collections
Wedding & Elopement Officiant, Julie Adriansen
Jes Berkman offers consultation based wedding and elopement planning for Colorado couples at any point in the planing process, whether you’re just getting started or a week out from the big day.
Discover the latest additions to our collection—handpicked pieces that bring new energy to your space.

## google reviews (top 3)
- (5★ 2025-01) We eloped in Vail, CO on January 15. Julie officiated, the ceremony she created and conducted exceeded any expectations or anything we could have dreamed of. We had a phone call with Julie, prior to our trip. During that call we told Julie our story and answered a few questions. The ceremony she wrote reflected every bit of our journey together and with such detail and heart. It went beyond words,
- (5★ 2025-06) Julie, the officiant from Vail, went above and beyond from the very beginning. Her process leading up to the ceremony was exceptional—organized, thoughtful, and very attentive to every detail. She guided us through the marriage license process in Eagle County and made sure we understood each step clearly. She provided helpful insight into how the ceremony would flow, which gave us so much peace of
- (5★ 2025-06) Julie is awesome - straight up. She just officiated our micro-wedding last week in the Colorado National Monument and it was so sweet and intimate. She took the time to meet with us via Zoom prior to the event to get to know us and crafted a perfect little ceremony to reflect us as a couple and include short antidotes about us, our favorite poem and unique vows inspired by a former educator of min

=== PHOTOGRAPHER: Colt & Hannah Photography | vendor_id=7a406cb1-0b3f-4645-8ad2-c01d3e1e94f0 | bot=bot14 | date=2/2025 ===
# Colt & Hannah Photography (Durango) — vendor_id=7a406cb1-0b3f-4645-8ad2-c01d3e1e94f0
site=http://www.coltandhannah.com/ | google 5★ × 29

## site pricing/package lines
Wedding pricing in Durango, CO &mdash; Colt and Hannah Photography
Wedding + Elopement Photography Pricing
Just the two of you—or a handful of your favorite people. Elopements create space to slow down, be fully present, and celebrate your marriage in a way that feels deeply personal.
An intimate wedding gives you the best of both worlds. The meaningful connection of an elopement with the joy of celebrating alongside your closest family and friends.
Are you also interested in having video coverage of your wedding or elopement? We offer several video packages along with photography. From ceremony coverage to highlight films of your day.
Durango, Colorado Wedding and Elopement Photographers
About Pricing Elopements Blog Contact
Colorado Elopement Photographers &mdash; Colt and Hannah Photography
Colorado Elopement Photographers
Colorado is the perfect elopement destination. The San Juan Mountains including Durango, Telluride, and Silverton specifically are some of the most beautiful mountains in the state. As elopement photographers in Colorado, we make it our job to help you plan your elopement.
We travel to all parts of Colorado and the Four Corners area including Pagosa Springs, CO, Telluride, CO, Sedona, AZ, Moab, UT, Sante Fe, NM and more! Whether you want to elope in Colorado or elope in Utah, we want to be your elopement photographers.
What are Adventure Weddings + Elopements?
The Importance of Elopement Photography
Oh, and also! We have exciting news. We also photograph elopements in 35mm film! We have absolutely fallen in love with film, so we’ve started integrating it into our digital work. If you want the tangible physical feel of film, ask us about incorporating it into your photo shoot!

## google reviews (top 3)
- (5★ 2024-09) Colt and Hannah are nothing short of amazing humans and extremely talented photographers/videographers! We used their services for our elopement, just the two of us in the mountains and they somehow captured every moment of pure love and were able to translate that back to us in a phenomenal video and gorgeous photo gallery. I would get married again and again with the two of them alongside us. Th
- (5★ 2024-09) Colt & Hannah are exceptionally talented. We hit the jackpot when we found them to photograph our destination wedding. We could not be more in love with our wedding pictures and video. We enjoyed our time with them from the engagement pictures through the wedding reception. They knew just what to do to get us to look our best while having fun during the process. Personable and professional. Would 
- (5★ 2025-09) Colt & Hannah are a pleasure to work with and gave us the wedding photos of our dreams! Having Hannah there on my wedding day was so helpful. Her calming presence eased my nerves and she helped the day move along seamlessly.

=== PHOTOGRAPHER: CStrong Photography | vendor_id=decd23b8-4f3c-474f-9046-2ba422fef44b | bot=bot15 | date=7/2025 ===
# CStrong Photography (Durango) — vendor_id=decd23b8-4f3c-474f-9046-2ba422fef44b
site=https://cstrongphotography.com/ | google 5★ × 42 | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2024-06) Carolyn and team was amazing on our wedding celebration. She spent so much time with us going to different locations around the venue property and different poses to ensure we would love the end product. They really went above and beyond to rally my husbands large family into photos so everyone felt included and was photographed. (Which believe me is no easy feat) . Both Carolyn and Jared were so 
- (5★ 2025-11) Carolyn was seriously so amazing to work with! She helped us plan our elopement out and gave us so many ideas to help make our day literally a fairytale. We were coming from out of state so she recommended multiple locations and even went and took pictures of them to help us decide where to go. She was also super knowledgeable about the area and gave recommendations for florists in the area. Our p
- (5★ 2025-12) Carolyn's work of art is such a masterpiece! She is intentional with every photo shoot and she truly is one of a kind. She is an artist at heart and she demonstrates this in her photography. It was my first time to experience working with a professional photographer and I can really see the difference she makes in her photos. She is very meticulous and excellent photographer. I like the photos she

=== PHOTOGRAPHER: Danielle DeFiore Photography | vendor_id=b42a322a-ffe7-45fa-9884-a92ad20c4b48 | bot=bot16 | date=12/2025 ===
# Danielle DeFiore Photography (Aspen) — vendor_id=b42a322a-ffe7-45fa-9884-a92ad20c4b48
site=https://danielledefiore.com/?utm_source=google&utm_medium=business-profile&utm_id=local | google 5★ × 109

## site pricing/package lines
Check out my collection of Weddings at aSPEN, Co Wedding Venues

## google reviews (top 3)
- (5★ 2025-10) Working with Danielle was an absolute dream from start to finish. She photographed our 3-day Indian wedding in Denver, and the way she captured every single event, moment, and emotion was beyond anything we could have imagined. Her photos are soooo stunning, vibrant, heartfelt, and full of life. She didn’t just document our wedding; she told our story in the most beautiful, authentic way. From the
- (5★ 2025-01) Danielle was absolutely exceptional for my September wedding. I booked her 18 months in advance because finding the right photographer was one of my top priorities, and she exceeded every expectation I had. To kick off our wedding year, we had her shoot our engagement photos in Aspen. She found the most stunning locations, capturing the perfect lighting and our love in such an authentic way — all 
- (5★ 2025-01) Just wow! My husband and I had the most incredible experience during our elopement with Danielle as our wedding photographer in Aspen, Colorado. From start to finish, she was the epitome of professionalism—her warmth, creativity, and ability to make us feel at ease truly sets her apart. Every moment of our photo session felt natural and special, and it’s clear that Danielle’s talent and passion sh

=== PHOTOGRAPHER: David Gillette Photography | vendor_id=83c79768-b86d-4f18-882c-94e799007d43 | bot=bot17 | date=8/2025 ===
# David Gillette Photography (Vail) — vendor_id=83c79768-b86d-4f18-882c-94e799007d43
site=http://davidgillettephotography.com/ | google 5★ × 13

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2016-12) I don’t even know where to start, Dave is absolutely perfect. From the moment I saw his website, I knew that he had an eye for great photography. My husband and I do not live in Colorado, so our first communication was via email. We set up a call and Dave is so personable and easy-going, we knew he would be the best person to capture our special day. Dave was extremely responsive during the entire
- (5★ 2014-08) If you are looking for someone who is creative, innovative, and a gem of a person, look no further than David! He was a delight to work with. We hired David to shoot our engagement photos and our wedding last fall. We trekked up to Piney Lake, an area north of Vail. He had an picked out some amazing spots for us to hike and enjoy the outdoors. The shots he got were breathtaking, we get so many com
- (5★ 2016-04) We loved working with David! He was always very quick to respond, easygoing, organized and fun to work with throughout the process. Prior to our wedding day, David visited the site to figure out the best spots for photos. I wanted to take pictures at a few locations and he scoped everything out to make sure we got the pictures that we wanted. We did not do engagement pictures so we were a little n

=== PHOTOGRAPHER: Distinctive Mountain Events | vendor_id=02c65599-da26-4f99-b73e-ae8543751185 | bot=bot1 | date=6/2025 ===
# Distinctive Mountain Events (Breckenridge) — vendor_id=02c65599-da26-4f99-b73e-ae8543751185
site=http://distinctivemountainevents.com/ | google 5★ × 58

## site pricing/package lines
The Month of & More is for those of you who would like to plan your wedding but need a little help getting there. We assist you with vendor selection and have a consultant available to you to answer any question at any time. With this package
Please contact us for pricing 720.346.4514 or info@distinctivemountainevents.com

## google reviews (top 3)
- (5★ 2024-10) Hire Distinctive Mountain Events/Ebs Long!!!!! There are no words to fully describe the gratitude, appreciation and admiration I have for Ebs, but I do know that hiring her was by far the best decision in our entire wedding planning journey. From the very first phone call, it was clear we were in great hands. She was not only incredibly knowledgeable about so many things, but also warm and friendl
- (5★ 2024-10) From the moment we began planning our Breckenridge wedding, Ebs with Distinctive Mountain Events was an absolute dream to work with. Her dedication and expertise transformed our unique vision for our day into a breathtaking reality. She took the time to understand our style and preferences, guiding us through every step of the planning process. What truly set her apart was her exceptional ability 
- (5★ 2022-04) Planning a wedding out of the state can be hard but with Ebs I felt so confident that everything would go perfectly! Ebs was so sweet and nice to work with. She made me think about little details I never would have thought about and logistics of transportation and rentals that never crossed my mind. I felt like she always really listened to me and heard all the details that were special to me. Lea

=== PHOTOGRAPHER: Dog Daze Photo | vendor_id=94f6351c-be5d-4872-a335-667d649f6ed3 | bot=bot2 | date=6/2026 ===
# Dog Daze Photo (Boulder) — vendor_id=94f6351c-be5d-4872-a335-667d649f6ed3
site=http://www.dogdazephoto.com/ | google 5★ × 44

## site pricing/package lines
DOG DAZE PHOTO PRICING
Wedding Photography Prices
a hand designed leather flush mount album
*An engagement shoot can be added to any package for $350
* Please add $100 for every 2 hours of travel time for out of region weddings or split days.
*a hand designed leather flush mount album can be added to any package for $650
*while basic artistic editing is included in the package, retouching such as stray hair removal, skin touch ups etc. is limited to 10 photos. Each additional photo is $20 per touch up.
This session is for family portraits that include family members outside of the nuclear family ie: grandparents, cousins etc. Pricing depends on number of people added.
Prices include rights to unlimited promotional use only. Use for merchandising (ie:t-shirts,CD Cover, posters etc) requires an additional fee and permission
BAND PROMOTIONAL PHOTOS/ALBUM COVER
price varies, contact me
Rock & Roll Print Prices

## google reviews (top 3)
- (5★ 2025-02) I wish I could give Lisa from Dog Daze Photos more than 5 stars! She is truly the most amazing photographer I have ever worked with. Lisa has an incredible ability to capture a moment in time so vividly that you can almost feel the air and smell the atmosphere just by looking at her photos. We have used her for our daughter's senior pictures and modeling digitals, and if I could go back in time, I
- (5★ 2025-02) Lisa is a true artist! Passionate about her work and craft, her creativity is abundant. Her professionalism at events is unparalleled. She did an amazing job photographing our wedding! At our rehearsal dinner she captured the most memorable moments that only a true professional and creative person can do! Her black and white rock and roll photography is far beyond excellent, with such an incredibl
- (5★ 2025-12) Lisa is a fantastic photographer! Her vast experience shooting live performances. weddings/ gatherings of all sorts, gives her a unique eye. She is incredible at capturing the special moments.

=== PHOTOGRAPHER: Donovan Pavilion | vendor_id=e81845ec-3587-4763-8293-345eb818c9e9 | bot=bot3 | date=2/2025 ===
# Donovan Pavilion (Vail) — vendor_id=e81845ec-3587-4763-8293-345eb818c9e9
site=http://www.donovanpavilion.com/ | google 4.7★ × 138

## site pricing/package lines
Rates & Policies 2027 Rental Rates
Every event at the Donovan Pavilion is required to follow our event guidelines, submit the necessary deposits, and ensure catering and cleaning checklists are completed. Please use the navigation on this page to explore our event guidelines. If you have any questions, please contact us anytime.
Security and Damage Deposit Information
Reservation Deposit: 50% of the usage fee (applied towards rental. non-refundable)
Damage Deposit: $500 (refundable 45 days following event date)
Security Deposit Policy:
A 50% non-refundable deposit toward the usage fee is required to hold a date upon execution of the agreement.
The security deposit is required upon execution of the agreement.
Usual and customary cleaning of the facility is included in your lease rate. Any additional cleaning needed as a result of your event, (i.e. carpet cleaning, removal of trash, windows, etc.) will be retained from your security deposit.
2026 Rental Rates 2027 Rental Rates
2026 Rental Rates | Vail, CO
Peak Season / Fri-Sun Use Rates: 2026
Mon-Thurs Use Rates: 2026
*Applies to each alcohol per hour that alcohol is served.
Additional hours may be purchased for $350 (including tax and staffing) per one hour block.
Rates Listed Include:

## google reviews (top 3)
- (5★ 2025-12) We always enjoy working weddings at Donovan Pavilion because the space gives couples so much creative freedom. The main hall is spacious and elegant, the large patio is ideal for outdoor moments, and the surrounding area offers endless portrait opportunities. The ability to bring in outside catering and vendors is a huge advantage for couples who want a customized experience. Photographing and fil
- (5★ 2025-10) The Donovan Pavilion was the most perfect venue for our wedding reception. It was able to accommodate our large guest list and the location could not be more beautiful. The venue is so beautiful that we were able to save a lot of money on decor and florals. Our cocktail hour outside was a dream! We loved working with Mindy and the team - they were so responsive and helpful through the entire proce
- (5★ 2025-08) As a florist I love the Donovan Pavillion! The space is beautiful and so peaceful by the river. I especially love the outdoor ceremony area nestled in the trees. The staff are wonderful and so on top of things. Its very clean and everything runs like clockwork. I always look forward to flowering events there! Four Seasons Custom Florals

=== PHOTOGRAPHER: Doug Treiber Photography | vendor_id=67d86eb1-99c3-49f0-96cc-c3846ed08b69 | bot=bot4 | date=5/2025 ===
# Doug Treiber Photography (Breckenridge) — vendor_id=67d86eb1-99c3-49f0-96cc-c3846ed08b69
site=https://www.dougtreiber.com/ | google 5★ × 38

## site pricing/package lines
What is your approach to wedding and elopement photography?
Yes! We primarily shoot in Breckenridge, Vail, Beaver Creek, Steamboat, Winter Park, and Aspen but we are available to travel worldwide! We have shot in many locations across the US and Europe. For locations that are farther than 2 hours from our home in Breckenridge travel fees may apply.
Typically couples book 6-12 months in advance for larger weddings. We recommend contacting us early in the process to inquire about available dates. Couples can also book a date by signing our contract and paying the retainer fee even if they are not 100% sure of their other wedding details.
Do you offer engagement sessions in addition to wedding day coverage?
Yes! Engagement sessions are a great way for couples to get comfortable in front of the camera and for us to get to know our couples and what they enjoy. The engagement photos are always a fun adventure!
What is your pricing structure for wedding photography packages?
Our full day wedding photography packages start at $4500 and include unlimited wedding day coverage with two photographers, an engagement session OR rehearsal dinner coverage and a private gallery of photos. Couples have print rights to all photos delivered in the final gallery.
We have many more packages available and can customize a package to fit your exact needs!
What is your pricing structure for elopement photography packages?
Elopement coverage starts at $1200 for 2 hours of coverage. Couples can add extra hours for $500 an hour. 4 hours is the maximum number of hours for an elopement package. If a couple wants more hours they would move to a full-day wedding package.

## google reviews (top 3)
- (5★ 2024-10) Doug and Jackie were our photographers for our wedding (recommended by our wedding planner, L Elizabeth Events) and we could not have made a better decision! 11/10 recommend! Doug and Jackie are an incredible husband and wife team and work together to capture the most amazing memories. They are so much fun and keep you engaged and laughing the whole time. We had an initial engagement shoot in Boul
- (5★ 2023-11) Working with Doug and Jackie was such an amazing experience from start to finish, but especially on the day of our wedding! We'd planned a rather ambitious ski/snowboard ceremony at Arapahoe Basin, and these guys hit every item on our wish list in an incredibly short time frame. Having never met us before, they hit the ground running, helping us get shots on the snow with our dogs and making us la
- (5★ 2026-01) We had an absolutely amazing experience working with Doug and Jackie Treiber for our wedding! Their experience was evident from the start—they knew exactly how to capture beautiful photos efficiently and from multiple angles without ever feeling intrusive. Communication was seamless, which was especially important since this was a destination wedding and we were coordinating from out of state. The

=== PHOTOGRAPHER: Dre Lamar Photography | vendor_id=6599a79b-bcb1-4e5a-93cb-721fc4abd2d2 | bot=bot5 | date=6/2025 ===
# Dre Lamar Photography (Colorado Springs) — vendor_id=6599a79b-bcb1-4e5a-93cb-721fc4abd2d2
site=https://www.drelamarphoto.com/ | google ?★ × ?

## site pricing/package lines
Senior Photo Session Classic Package
Senior Photo Session Premiere Package
Senior Photo Session Paramount Package

=== PHOTOGRAPHER: Dreamtime Images Photography | vendor_id=08de28aa-8ee8-45b8-a1d4-b1eedf4d9c05 | bot=bot6 | date=2/2026 ===
# Dreamtime Images Photography (Estes Park) — vendor_id=08de28aa-8ee8-45b8-a1d4-b1eedf4d9c05
site=http://www.dreamtimeimages.com/ | google 5★ × 23

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2019-02) As we proudly show our wedding and honeymoon photos to family and friends, we often here some variation of “oh my God, those are the most beautiful wedding photos I have ever seen!” (And we're pretty sure this isn't people just being polite...) From intimate tears to grand mountain vistas, Nathan produced exquisite visions we’ll cherish forever. Nathan is so attentive to what you want, and willing
- (5★ 2021-09) Dreamtime Images (Nathan) made our day an incredible experience. From helping us find the perfect spot to being an impromptu shuttle driver, he was like another member of our family, just lending a hand and willing to go above and beyond to make the day special! His professionalism and terrific attitude made our day effortless and even more special. Of course, his photography is A-M-A-Z-I-N-G! You
- (5★ 2016-03) Nathan was absolutely fantastic to work with. He went above and beyond to make sure everyone at our wedding felt comfortable during pictures. He took some of the most amazing pictures and truly captured what I would consider to be a perfect day! His knowledge of Estes Park allowed us to take gorgeous pictures in some very unique locations. Even after the wedding Nathan was available to us and kept

=== PHOTOGRAPHER: EagleVail Pavilion | vendor_id=bbb748a6-ca69-46d5-92ef-51c0cba866d1 | bot=bot7 | date=4/2025 ===
# EagleVail Pavilion (Avon) — vendor_id=bbb748a6-ca69-46d5-92ef-51c0cba866d1
site=http://www.eaglevailpavilion.org/ | google 4.7★ × 54

## site pricing/package lines
Venue Pricing and Information

## google reviews (top 3)
- (5★ 2024-10) We got married at the Eagle Vail Pavilion in August 2024. It was a bit difficult to initially get in contact with the staff, but we eventually got everything booked. This venue is truly a blank slate for whatever you want your wedding to look like, and it allows for a great deal of creativity and freedom in choosing your vendors. The pond, deck, and florals were so pretty, and the tables and chair
- (5★ 2021-07) EagleVail Pavilion was the PERFECT venue for our wedding! We planned and re-planned our wedding a few times during the pandemic, and we finally landed on the EagleVail Pavilion which easily flexes to accommodate a large or small guest count. Our final guest count was 40 people, and we used two long banquet tables for the reception seating. We had our ceremony outdoors on the grass. Shaun Histed, t
- (5★ 2021-08) Loved this Pavilion as a wedding venue! Great lawn for a ceremony and the pavilion makes for a great indoor/outdoor reception. Not too many mountain views, but a little bit! Cute pond with water fountain right outside the building. Nice park like setting.

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-05.csv
