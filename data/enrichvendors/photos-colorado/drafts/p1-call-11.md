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


=== PHOTOGRAPHER: Original Weddings Photo & Video | vendor_id=23fb04c9-a80e-436a-8b48-60e7b4d040b2 | bot=bot15 | date=11/2025 ===
# Original Weddings Photo & Video (Denver) — vendor_id=23fb04c9-a80e-436a-8b48-60e7b4d040b2
site=https://www.originalweddings.com/locations/colorado/denver/ | google 4.8★ × 28

## site pricing/package lines
check availability & pricing
The Mill Event Venue Wedding Packages
Our team of Denver wedding photographers captures hundreds of weddings, elopements and engagements each year across Colorado. We&#8217;re so thrilled to show you some recent real weddings!
Engagement Session Photography at Genesee Park | Mckenna & Ryan
Engagement session photography at Genesee Park in Colorado always feels open, peaceful, and full of&hellip;
Our team of Denver wedding videographers films weddings and elopements at hundreds of Colorado venues. We hope you enjoy these recent films.
Whether you love elegant wedding videography collections or raw, emotional storytelling, we offer two distinct styles to ensure your wedding video reflects your personality.
see timeless collection
see rustic collection
Rustic Collection – A dramatic, cinematic wedding film with artistic transitions, slow-motion shots, and emotional storytelling.
Timeless Collection – A documentary-style video that presents your wedding in a natural, true-to-life sequence.
Original Weddings is amazing! Extremely professional, nice, and quick. The picture quality is amazing and there staff have an amazing vision for posing.I would recommend to anyone. Definitely worth the price!
Original Weddings is proud to be among the top wedding photographers in Denver. Our professional photographers offer documentary, photojournalistic and candid wedding and elopement photography styles.
Do you offer engagement sessions?
Yes! Engagement sessions are a great way to get comfortable in front of the camera before your big day.

## google reviews (top 3)
- (5★ 2026-01) We had an absolutely wonderful experience working with Angela through Original Weddings for Audrey & Logan’s wedding in 2025. Angela was incredible to work with from start to finish. She was professional, warm, and brought such a calming presence to the day, which made a huge difference for both the couple and the vendor team. She captured the day beautifully—paying close attention to meaningful m
- (5★ 2026-03) We had such a great experience working with Original Weddings on this Denver wedding. If you’re looking for a Denver wedding photographer, their team is incredible. They were professional, easy to communicate with, and made the day feel seamless for both us and the couple. The photos and video turned out beautiful, and it’s clear they really care about their work and their clients. We’d happily wo
- (5★ 2025-09) Our original photographer never got back to me, and with 3 weeks to spare I reached out to Original Weddings. They ensured that I was well taken care of and Hunter was our photographer for my wedding. He was absolutely wonderful and made sure that our photos were the best I have ever seen! We got our photos back within 2-3 weeks, and I am so blown away by them!!

=== PHOTOGRAPHER: Party Girl Events | vendor_id=e7c1a9e6-2aae-4c52-a675-8554eef4bf81 | bot=bot16 | date=6/2026 ===
# Party Girl Events (Vail) — vendor_id=e7c1a9e6-2aae-4c52-a675-8554eef4bf81
site=http://www.partygirl.events/ | google 5★ × 33

## site pricing/package lines
($95 per person/ $7,500 minimum)
(Wedding Management typically ranges from $3,000-$4,500)
Elopements (Small Weddings)
(Elopements typically range from $2,500-$4,500)
Our services are priced between $1,500 and $1,800, with additional costs for photography, decor, and other extras.

## google reviews (top 3)
- (5★ 2023-11) Stephanie was an absolutely incredible wedding planner, I can't say enough great things about her!! She was so professional, efficient, organized, caring, and fun to work with! She made the wedding planning process SO much less stressful and we couldn't have pulled off our gorgeous wedding at Camp Hale without her! The first phone call I did with her before we even booked her services, I was very 
- (5★ 2025-12) Stephanie was an absolute dream to work with planning our destination wedding in Vail. Her network of vendors is extensive in the area which made planning with trusted partners much easier. Plus, they all love working with Stephanie and the energy and professionalism she brings to every event. Our wedding was absolutely magnificent, with several guests commenting it was one of the best they have e
- (5★ 2022-04) Stephanie and Caroline were absolutely fabulous!! My wife and I got married in Copper Mountain this past January and they made our wedding a dream come true! They worked with us for well over a year planning our destination wedding and it turned out perfect! Delivering everything my wife asked for, even all the vendors they recommended were perfect. We highly recommend them to anyone looking for a

=== PHOTOGRAPHER: PHOCO | vendor_id=08fd23ac-d878-4bbc-8c68-34cd44f9a9e5 | bot=bot17 | date=7/2025 ===
# PHOCO (Fort Collins) — vendor_id=08fd23ac-d878-4bbc-8c68-34cd44f9a9e5
site=http://www.pho-co.com/ | google 5★ × 28

## site pricing/package lines
Fort Collins Elopement | Rist Canyon Inn | Andrea & Peter
Fort Collins Engagement Session | Bad Ass Motorcycle Couple | Sarah & Cody

## google reviews (top 3)
- (5★ 2026-06) Where do we even start?! Patrick, Alex, Alec, and Becca from PHOCO were fabulous! Patrick and his team met and exceeded our photography and videography needs. We would highly recommend PHOCO for not only their attention to detail but also for their professionalism and their creative ideas. We get teary-eyed every time we look at the photographs and have already started planning on how we will fram
- (5★ 2025-09) When we thought about our wedding photographer, we knew we wanted someone who was not only incredibly skilled but also easy and chill to be around. We were looking for candid moments and real emotion rather than stiff, staged smiles, and since we’d be spending most of the day with this person, the energy had to feel right—especially for two people who are a bit camera-awkward! Patrick was everythi
- (5★ 2016-09) PHOCO is incredible! We hired them to capture our wedding and engagement photos (July 2016) and we could not be any happier with the decision. They are so talented, friendly, easy to work with (they make you feel comfortable!), timely, and creative! They captured moments on our wedding day that we will forever cherish. Patrick and his team are true professionals and handled every last one of our r

=== PHOTOGRAPHER: Photography by Brenda Colwell | vendor_id=33f2432d-1974-43cd-9656-da13e9204795 | bot=bot1 | date=4/2026 ===
# Photography by Brenda Colwell (Telluride) — vendor_id=33f2432d-1974-43cd-9656-da13e9204795
site=http://www.brendacolwellphoto.com/ | google 4.6★ × 9

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (1★ 2018-06) I had planned to have my wedding in Colorado last July, and I had chosen Brenda to be our photographer. We loved her photos, and when we went up to meet with her, we felt that she was a reputable photographer with a strong understanding of family values. 25 days before our wedding, I contracted a virus that left me fully paralyzed with respiratory failure in ICU for 3 1/2 weeks. My husband and fat
- (5★ 2018-07) We hired Brenda Colwell Photography to take our son's Senior pictures. We were so pleased with the entire process. The "magic" in a portrait seems to be in getting the emotion to come through along with the great visual. Within minutes she had him relaxed and captured his personality perfectly. We had our proofs in a timely manner and the final results were breathtaking and we will treasure them f
- (5★ 2018-07) Brenda is one of Telluride’s most beloved local talents. The “go to” of choice for portraits and events. As a resident who loves and truly sees the beauty in the mountains she calls home she brings that emotion to her photography. She is a wonderful mom and dog lover. Her affection for and connection with the families she photographs plays a vital role in the lovely way she captures the style and

=== PHOTOGRAPHER: Picturesque Photography | vendor_id=37b14a45-4a02-47e3-a1b8-e9a518bd27fc | bot=bot2 | date=2/2026 ===
# Picturesque Photography (Telluride) — vendor_id=37b14a45-4a02-47e3-a1b8-e9a518bd27fc
site=http://www.picturesquephoto.co/ | google 5★ × 9

## site pricing/package lines
Our packages include all of your photos delivered in a modern online gallery; to easily share on social media, order professional quality prints and allow download access for friends and family.
Telluride Elopement Photographer &mdash; Picturesque Photography
Elopement Photography Packages include planning, local vendor recommendations & our Telluride Elopement Guide
Trout Lake Adventure Elopement
Alta Lakes Adventure Elopement
Bridal Veil Waterfall Adventure Elopement
Mount Sneffels Adventure Elopement
Silverton, Colorado Adventure Elopement
San Sophia Overlook Telluride Mini-Elopement

## google reviews (top 3)
- (5★ 2021-08) Our family of 6 headed to Telluride for a last week vacation~ I think there is so much value in hiring photographers!! Especially when you travel, totally worth every penny!! Wren did a fantastic job! I cannot express enough how thankful I am for her work she did for us. First of all, she responded right away and we were able to schedule a shoot. There was smoke from the Cali fires, so she was gra
- (5★ 2020-11) Wren and Corey of Picturesque Photography went ABOVE AND BEYOND what normal photographers should do. Not only are the quality and quantity of our elopement photos superb, but the extra mile that they went! WOW, just wow! If you are Eloping anywhere near Telluride, CO I pray y'all get to use this company. From the planning and timeline, down to the day of bringing things we didn't think of or littl
- (5★ 2021-01) My fiancé and I planned a last minute work-vacation shortly after getting engaged, and wanted to capture some engagement photos while we were in Telluride. I found Wren through Google and she was so prompt in getting back to me. We were able to capture photos in a number of different locations, and her turnaround was so fast. Her work is beautiful; I'm so glad we were able to find her. I'd definit

=== PHOTOGRAPHER: Preston Benson Videography: Durango Video Production | vendor_id=0ad3f282-a964-40a0-a054-20afad19a686 | bot=bot3 | date=2/2026 ===
# Preston Benson Videography: Durango Video Production (Durango) — vendor_id=0ad3f282-a964-40a0-a054-20afad19a686
site=http://prestonbenson.com/ | google 5★ × 28

## site pricing/package lines
VIDEO DEPOSITIONS / LEGAL VIDEO
Colorado Wedding Films & Elopement Videos - Preston Benson Videography
Colorado Wedding Films &#038; Elopement Videos
Wedding Films start at $3000 / Photography starts at $2100
Inquire for Pricing and Availability
Telluride Elopement Film and Jeep Adventure
Dunton Hotsprings Winter Elopement Film
Inquire Here for Pricing and Availability
Preston Benson Videography - Southwest Colorado Video Production based in Durango: Director of Photograhy, Drone Pilot, Telluride Wedding Videographer, Corporate and Industrial Films, Real Estate Videos and Video Depositions
Our production company was tapped to provide a full production crew for this full day shoot for FirstNet, built by AT&T, the nation&#8217;s first high-speed, wireless broadband network&#8230;
Open Sky Wilderness Therapy made a big investment in updating their branding and marketing tool kit, along with a new website and brand new videos. Each of the&#8230;
Legal Video & Video Deposition Services - Preston Benson Videography
Legal Video &#038; Video Deposition Services
Legal videographers with 7 years of experience based in Grand Junction and Durango, Colorado covering video depositions across the Western Slope of Colorado, including Cortez, Pagosa Springs, Telluride, Alamosa and Montrose , as well as Moab, UT and Farmington, NM.
Video Depositions / Site Inspections
Digital Deposition Delivery

## google reviews (top 3)
- (5★ 2025-12) Our Company, United Pipeline Systems, has worked with Preston to film, photograph, and edit high quality project related videos for our use in Business Development, Sales, and Client Education purposes. Preston was quickly able to understand our vision and worked seamlessly with our field crews to capture visually appealing videos and photographs. We grateful for his willingness and ability to tra
- (5★ 2024-01) Preston is extremely professional, easy to communicate with, on time, and works well with other vendors. He made our entire family and bridal party feel at ease while being on camera, and he had a ton of creative ideas for footage. The final footage that Preston delivered to my husband and I was tear producing and insanely beautiful. I would recommend Preston to anyone needing videography services
- (5★ 2025-12) I worked with Preston on a corporate video project. He was professional throughout the process and his attention to detail and expertise really shows in the finished project. If you're looking for someone to create high-quality video content, I highly recommend Preston.

=== PHOTOGRAPHER: Princess Productions Weddings & Events | vendor_id=bf4be683-3c72-4171-a54e-5915297a9baf | bot=bot4 | date=2/2025 ===
# Princess Productions Weddings & Events (Crested Butte) — vendor_id=bf4be683-3c72-4171-a54e-5915297a9baf
site=http://princessproductionsweddings-events.com/ | google 5★ × 2

## site pricing/package lines
(none found on site)

## google reviews (top 2)
- (5★ 2024-09) Stephanie Prater of Princess Productions truly brought our wedding celebration to life in the most beautiful way. She effortlessly captured my vision and executed it to perfection, even with the minimal guidance I was able to provide on the day of. Her creativity and attention to detail transformed the event into something beyond what I had imagined. So many people have seen photos of our celebrat
- (5★ 2017-06) Unique concept weddings in beautiful Crested Butte Colorado and beyond!

=== PHOTOGRAPHER: Ranjani Groth Studios | vendor_id=08829c2f-72d3-4e6b-8b37-5bfb2cf4b30e | bot=bot5 | date=5/2026 ===
# Ranjani Groth Studios (Golden) — vendor_id=08829c2f-72d3-4e6b-8b37-5bfb2cf4b30e
site=http://ranjanigroth.com/ | google 4.9★ × 67

## site pricing/package lines
to print your art (and some digital options too) and customize our packages to fit your
Each photo session is a flat fee of $300.
The average family invests upwards of $1,000 for their images.
really good packages that offer a lot that also comes with amazing ability.”
Photography is an investment. That’s why guiding you through the process is a
The average family invests around
What about digital file collections?
PACKAGES STARTING AT $1795
Our prints and packages are totally customizable, and we find many of our
Matching digitals are included in most of our print portrait packages.

## google reviews (top 3)
- (5★ 2024-01) Working with Ranjani is the best photo experience you can imagine! I saw her work online and loved her black and white expertise. I decided to do a fun photo shoot with my dogs, more so to meet Ranjani and see if she might be a good fit for some other professional projects I have upcoming. I'm SO glad I did, because not only do I have the most amazing forever memories with my dogs now, but I'm exc
- (5★ 2024-03) We went to Ranjani for a family (including our doggos) & pregnancy photo session! We had 3 dogs, 2 of them puppies and full of energy, and Ranjani was amazing at corralling the their energy to capture some truly amazing photos. She has a gift for allowing the dogs to be dogs, and capturing their spirit, not to mention getting them to be still for just moments to snap the shot! The whole experience
- (5★ 2022-11) I have worked with Ranjani on a month-long photojournalism project in Mexico and I recently employed her services for my engagement photos. As both a colleague and a hired photographer, Ranjani is a consummate professional, generous with time, and extremely talented. She is incredibly easy to work with, goes above and beyond to to overcome unexpected hurdles, and on top of all of that is gracious,

=== PHOTOGRAPHER: Real Life Photographs | vendor_id=3852f841-19c3-4d00-842f-4f71763bb2e5 | bot=bot6 | date=5/2025 ===
# Real Life Photographs (Ridgway) — vendor_id=3852f841-19c3-4d00-842f-4f71763bb2e5
site=https://reallifephotographs.com/ | google 5★ × 9

## site pricing/package lines
Telluride Engagement Session
Watch me in action as I photograph this summertime engagement session in Telluride, Colorado
Telluride Wedding Albums
Showcasing Real Life Photographs fine art 10x10 wedding albums and books.

## google reviews (top 3)
- (5★ 2025-09) Kaycee was a breath of fresh air. Not only is she an excellent photographer, she is also a lovely person inside and out. She asked many great questions to maximize my expectations for the day and far exceeded those. I would highly recommend Kaycee for your wedding or any event that is important to you.
- (5★ 2026-03) My family and I have had the pleasure of working with Kaycee many times -- she has captured countless milestones and memories (both human and fur-baby), and we treasure the photographs she has taken. Kaycee's creativity and ability to nurture an atmosphere of comfort and fun is truly unrivaled in my experience. Her work reflects her unique point of view and voice -- one that she has honed during h
- (5★ 2025-05) Kaycee is one of the most genuine, kind and talented photographers!!! As a longtime local to the Telluride area, she knows the ins and outs of where to go and when for beautiful views and amazing images! I also really love her studio series, she’s one of the only Photography Studios in the area. Her ability to bring out a person‘s character and personality through an image is incredible! You’ll be

=== PHOTOGRAPHER: Real West Old Time Photography | vendor_id=78f1a812-c1e0-4aad-a17c-95a1b8920f95 | bot=bot7 | date=2/2026 ===
# Real West Old Time Photography (Estes Park) — vendor_id=78f1a812-c1e0-4aad-a17c-95a1b8920f95
site=https://www.facebook.com/RealWestPortraits/ | google 4.5★ × 115 | SITE CRAWL FAILED (HTTP 400)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (3★ 2026-02) The staff is very nice, the place is cool, I overall liked the experience. My only issue unfortunately was the fact that there was no one after us waiting to take pictures, but we felt rushed by the lady taking the picture. She didn't took her time to let us be creative, she just told us what to do and didn't even gave us a chance to actually smile when she told us to "smile". I felt so rushed dur
- (5★ 2023-10) The woman who helped us was extremely nice even though she was very busy. It is awesome that the business has been I. The family for so long and that she had made some of the costumes herself. Our photos came out great. She even helped us take photos of our dog and it was adorable. She obvious knew what she was doing. I would have like more time and options to take the photos though. I felt fairly
- (1★ 2025-09) my friends and i were in a week ago, and unfortunately i discovered this place gave me CHIGGER bites from probably the feather boas. i have massive welts around my arms and wrists almost exactly where to boa was photographed on me. after researching and being in intense pain for a week with no other possible source i’ve come to the conclusion it had to be from here. i’ll be contacting the business

=== PHOTOGRAPHER: Rebeca Velie Photography | vendor_id=cfe95206-1c42-463a-9e91-195227286146 | bot=bot8 | date=1/2025 ===
# Rebeca Velie Photography (Golden) — vendor_id=cfe95206-1c42-463a-9e91-195227286146
site=https://www.rebecaveliephotography.com/ | google 5★ × 74

## site pricing/package lines
Rebeca Velie Photography | Investment
You're investing in stopping time and capturing your relationships, family, and life just as they are: right now .
- Digital album & high-res downloads
Making it official with just the two of you? Sounds amazing. This package includes candid coverage of your intimate ceremony & a more-focused couples' session.
- Inquire for wedding packages
I seamlessly document both photos and video, ensuring you receive a beautiful album of images and a short highlight film to relive your wedding day for years to come.
Hybrid coverage can be added to any package, starting at $1,100.
DO YOU OFFER WEDDING PACKAGES?
Yes! When you inquire I'll send a detailed breakdown of the packages I offer and then work with you to craft the perfect package for your special day.
CAN WE GET PRINTS OR PHOTO ALBUMS?
To make things official I require a signed contract and 50% retainer. Email me or use the contact form and we can get the ball rolling. I can't wait to hear about everything!
For senior, family, and engagement sessions, I prefer to hold these sessions when the light is at its best. This is typically an hour or two before sunset and just after sunrise. We try to avoid midday sessions as the sun is bright and high in the sky causing subjects to squint.
-&gt; In our dream wedding, where are we? A rustic barn? A mountain top elopement? A grand hotel overlooking a lake? A tropical island?
Have other questions: Check out the Q&A section at the bottom of the investment page
From Next-Door Neighbors to “I Do” – A Special Engagement Session
pdf rate cards seen on site (not fetched): https://www.rebecaveliephotography.com/_files/ugd/0e1b10_1d1ee88555194264a44becc1ff219749.pdf?index=true

## google reviews (top 3)
- (5★ 2025-10) Becky was the best wedding photographer I could have asked for and I can’t recommend her highly enough! As someone who is uncomfortable in front of a camera I was initially nervous about my pictures being taken but once Becky arrived she helped me feel not only comfortable in front of the camera but more relaxed about the day in general. Becky is such a kind, genuine and calming presence, her pass
- (5★ 2022-09) Becky was the perfect wedding photographer! We initially gravitated toward her because she was so encouraging, thoughtful, and had a calming/positive energy about her. We were 100% right to choose Becky. A few particularly awesome things about her: -she is helpful with coming up with ideas and making an adjustable plan -she is up for anything -she is kind and considerate -she is organized and punc
- (5★ 2025-08) We are so grateful to have chosen Becky as our wedding photographer! She made us feel so comfortable in front of the camera, even my husband who isn't a fan of photos. She struck the perfect balance of letting us truly be in the moment while also making sure every important shot was captured. On top of her incredible talent, she was such a calming and fun presence throughout the day. She kept us r

=== PHOTOGRAPHER: River Bend Ranch | vendor_id=199e14b2-fbf5-4de1-a198-1365eda71e82 | bot=bot9 | date=11/2025 ===
# River Bend Ranch (Durango) — vendor_id=199e14b2-fbf5-4de1-a198-1365eda71e82
site=http://riverbendranchdurango.com/ | google 4.9★ × 133

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-10) River Bend Ranch was the perfect venue for my partner, Sterling, and mine's wedding this past weekend (Oct.11, 2025)! The owners Dan and Jenny are such a delight and Brittney our planner is an absolute rock star!! From the months planning leading up , to the day of the wedding the whole team was truly amazing! Brittney is so knowledgeable about the area and all our vendors and she made our wedding
- (5★ 2022-10) River Bend Ranch is Awesome!!!! Dan and his team are super easy to work with, and our wedding was absolutely magical. The venue is gorgeous, and requires very little of our own decorations thanks to prejnstalled lighting and the beautiful setting. There was a small mix up on access time for the venue, but Dan was great and worked with us to get it all figured out. His team was there the whole time
- (5★ 2021-10) As a photographer, I can say the River Bend Ranch is truly a wedding dream! It's the perfect venue for a wedding! Not only is the venue absolutely stunning, but the staff excel in customer experience and taking care of their clients. They put so much care and time into the venue and every wedding or event that happens there. If you are searching for a venue with a rustic aesthetics, whimsical natu

=== PHOTOGRAPHER: ROGUE Photography | vendor_id=9a1e4b98-9cb9-4d95-8d71-6f6c71a44573 | bot=bot10 | date=5/2025 ===
# ROGUE Photography (Denver) — vendor_id=9a1e4b98-9cb9-4d95-8d71-6f6c71a44573
site=http://www.roguefilmco.com/ | google 4.8★ × 77

## site pricing/package lines
Home About Gallery Albums Gallery BLOG Packages Let's Chat
Half day 4 hrs $2500
Full Day 10 hr + Engagement $6500
Engagement Session (2 Hours)
Inquire for a custom package!
Adventure engagement $1500
Engagement (2hr) $1250
prints are available for purchase and can customize a print package

## google reviews (top 3)
- (5★ 2023-06) 1000% recommend! We had such a wonderful experience with Joshua, he gave me so much confidence from the beginning. We had not had the most promising experience with a previous photographer, so I definitely had some high expectations when looking for another photographer. Joshua instantly put me at ease and gave me confidence that I had made the right decision. Our first chat was very exciting as w
- (5★ 2025-10) Working with Rogue Film Co. for our wedding was nothing short of incredible, and all credit goes to Joshua, our photographer. From start to finish, he captured not just the moments, but the feeling of the day. Every shot looks like it came out of a magazine, yet somehow still feels authentic to who we are. What stood out most was how easy and natural everything felt. Joshua didn’t just show up wit
- (5★ 2025-04) Josh is an absolutely incredible photographer. My now husband and I hired him to do our engagement, rehearsal dinner, and wedding photos and both the experience and photos that resulted were an absolute dream. I usually feel pretty awkward having my photos taken and he not only made us, but also our guests, feel incredible in front of a camera (several of my friends commented on it to me the night

=== PHOTOGRAPHER: Ryan Kost Photo | vendor_id=406b7297-163a-4721-a446-d1e7487cac51 | bot=bot11 | date=4/2025 ===
# Ryan Kost Photo (Arvada) — vendor_id=406b7297-163a-4721-a446-d1e7487cac51
site=https://www.ryankostphoto.com/ | google 5★ × 57

## site pricing/package lines
Photography Pricing & Packages | Denver, Colorado Photographer | Ryan Kost
Elopement | Wedding | Engagement
Photography Pricing & Packages
Whether it’s a family adventure, surprise proposal, intimate elopement, or milestone— each experience is thoughtfully tailored and beautifully documented.
Family, Senior & Engagement Packages:
* A $50 deposit retainer is required upon booking
THE KEEPSAKE SESSION | $550
Sessions 50–100 miles from Denver include an additional $100 travel fee.
THE STORY SESSION | $850
DOCUMENTARY SESSION | $1,500 (4 hrs)
Colorado Elopements & Intimate Weddings Packages
A 25% deposit is required to secure your date upon booking.
Click to View My Step-by-Step Elopement Guide →
The Intimate Story | $1,800
3 Hours of Coverage -Within 100 Miles of Denver. If further away, please inquire!
Perfect for simple, intimate elopements in one beautiful location. We’ll capture your ceremony and explore nearby spots for portraits and candid moments.
The Full Story | $3,000
5 Hours of Coverage-Within 100 Miles of Denver. If further, please inquire!
Designed for elopements that include a short hike, multiple locations, or time with family afterward. We’ll document your day from start to finish — ceremony, portraits, and celebration.
The Epic Story | $4,500
Colorado Events & Branding Packages:
*$100 deposit retainer required upon booking
The Essentials Session | $650
Up to 1 Hour of Coverage
The Main Event Session | $1,500
Up to 3 Hours of Coverage
The Full Experience Session | $3,000
Ryan Kost Photo | Denver & Colorado Family, Elopement & Event Photographer

## google reviews (top 3)
- (5★ 2025-07) We had a wonderful experience with Ryan, capturing three families together in the beautiful mountains near Colorado Springs. From first contact to final delivery of photos Ryan communicated promptly, kindly, and with attention to detail. We booked the shoot from California ahead of our vacation in Colorado, and Ryan delivered ideas for location with exactly the kind of detail and consideration tha
- (5★ 2026-06) We had pictures taken for our anniversary and it was so worth it!! Ryan was so friendly, patient, chill, and funny. It was nice to chat with him, he was a great conversationalist trying to get to know us and letting us get to know him a bit, and he made us laugh a lot!! It really just felt like hanging out with a new friend. He had great ideas throughout the session! It was SO RIDICULOUSLY WINDY b
- (5★ 2026-01) Ryan made our family photo shoot such a memorable time! I’m so thankful he was willing to fit us in during the hectic holiday week. Ryan encouraged us to be ourselves. We laughed and played and enjoyed one another. Most family photo shoots have been stressful and we couldn’t wait to be done — but the time we spent getting these pictures taken was one of the highlights of our few days together. The

=== PHOTOGRAPHER: Sam Murch Photography | vendor_id=53789041-b67a-4415-b1f0-92c511395349 | bot=bot12 | date=10/2025 ===
# Sam Murch Photography (Ouray) — vendor_id=53789041-b67a-4415-b1f0-92c511395349
site=http://www.sammurch.com/ | instagram=@sammurchphotography | google 5★ × 89

## site pricing/package lines
01. Do you have a second shooter
I do! I have an awesome second shooter, and I'd love to talk with you about the benefits of having a second photographer for your celebration!
Wedding and Elopement galleries can be expected in 6-8 weeks from the event date.
Investment | Sam Murch | Ouray Wedding Photographer
Sam goes above and beyond to capture the moment. The wife and I were absolutely amazed with the album she sent us. We will be planning another shoot with her in the future!!”
Weddings starting at
Elopements can be anything you want them to be. You get to do you all day. One thing that rings true: there won’t be that many people to help you remember. Your photos will be the one piece of heritage you have of this beginning. It’s a sacred honor to photograph these days.
Elopements starting at
Full day elopement coverage
Digital photos will be delivered within 6-8 weeks of the elopement date
Second Shooter add-on option
Heirloom Album add-on option
Reach out about your elopement →
She effortlessly captured candid moments and genuine emotions. Her creative eye and attention to detail resulted in a stunning collection of photographs that perfectly encapsulated the joy and love of our special day.
Winter Elopement in Ouray, Colorado | Sam Murch Photography
Joyful winter elopement in snowy Ouray, Colorado

## google reviews (top 3)
- (5★ 2024-12) We first met Sam while in Ridgeway at my best friends wedding and after that we knew we wanted to use her for our own wedding in the future. We were lucky enough to be able to book Sam well in advance and we couldn’t have made a better decision looking back! Sam not only photographed our wedding but literally helped us set up an absolutely perfect adventure wedding day for me, my wife, and our gro
- (5★ 2025-10) Sam might be one of the kindest humans on this planet. My now husband and I found her by happenstance on Instagram and instantly fell in love with her photography. We set up a meeting with her to talk about what an elopement would look like, and talk about open dates. Sam made the process so easy. She provided a list of local vendors, that she had previously worked with and recommended. She provid
- (5★ 2025-09) I don't even know where to start with this review - Sam is AMAZING (and I'm not bias just because we share the same first name). We did a destination micro-wedding (~20 guests) and had a vision that after our small ceremony we would get into the mountains and capture some adventure photos (just the two of us). Sam listened to our vision and even sent over a digital guide so we could better visuali

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-11.csv
