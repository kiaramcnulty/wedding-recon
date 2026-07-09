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


=== PHOTOGRAPHER: K2 Event Co. | vendor_id=5729690f-7d56-4c17-a6b2-5f40c55e2bd3 | bot=bot2 | date=4/2026 ===
# K2 Event Co. (Telluride) — vendor_id=5729690f-7d56-4c17-a6b2-5f40c55e2bd3
site=http://www.k2eventco.com/ | google 5★ × 64

## site pricing/package lines
SPECIALIZING IN WEDDINGS, ELOPEMENTS, AND SOCIAL EVENTS

## google reviews (top 3)
- (5★ 2025-10) If you’re dreaming of getting married in beautiful Telluride, Colorado, look no further than K2 Event Co. for your planning team! K2 went above and beyond for our September 2025 wedding. We are a local couple and wanted a tented celebration on Last Dollar Road with just under 200 guests, a major undertaking that K2 made feel completely effortless! Throughout our year of planning, Kristen and her t
- (4★ 2025-09) K2 was absolutely essential for my wedding planning experience. Kristen and Annie were literal angels. They helped me plan our wedding and rehearsal dinner/welcome party. Our wedding was the most perfect, beautiful, magical day of our lives and everything went off without a hitch! I couldn't be more grateful. Unfortunately, some wires got crossed at some point while planning our welcome party. I h
- (5★ 2022-10) Kristen, Trisha, and the K2 team have absolutely everything you could want in a wedding planner. They are professional, communicative, creative, and incredibly authentic. Their knowledge of the venues and relationship with vendors is invaluable. Kristen took the time to understand our vision and needs and completely exceeded our expectations in every way. She has a quiet strength that keeps everyt

=== PHOTOGRAPHER: Kalen Jesse Photography Co. | vendor_id=bf565f33-7076-44f2-94cf-9f9ece5918cf | bot=bot3 | date=7/2025 ===
# Kalen Jesse Photography Co. (Denver) — vendor_id=bf565f33-7076-44f2-94cf-9f9ece5918cf
site=https://www.kalenjesse.com/ | google 5★ × 346

## site pricing/package lines
Weddings, Elopements, Engagements + Proposal Photographer
DENVER WEDDING AND ELOPEMENT PHOTOGRAPHER
Option to order Save The Dates directly from the album!
COURTHOUSE OR COUPLE- ONLY ELOPEMENT in Denver
Intimate Wedding or Elopement (up to 40 guests)
4 hours of coverage *(option to add additional hours)
$7400 average investment (can be modified as needed)
all inclusive Full Storytelling with Time for Candid + Editorial Moments - customizable packages!
8 hours of coverage (Can add up to 10 hours)
Includes 50% off optional 1 hour engagement session in Denver
Option to order high quality archival prints + albums directly from the online gallery
Film Photography, Photobooth, Videography, Vinyl DJ other add-ons available (discount if booked with a Classic Wedding package)
*Every wedding is different ----- Let us know the details of your special day so we can tailor packages to your specific needs (ie. payment plans, add ons, number of hours etc!)
*Full Weekend coverage starting at $10K (rehearsal dinner and 1-hour adventure session)
*No travel fees for Denver and DC, but will travel ANYWHERE for an additional fee.
Denver Wedding and Elopement Photography
A fun, flavorful Denver engagement session featuring love, delicious vibes, and a shared obsession with noodles and tacos - captured in...
So if you’re dreaming up an engagement session that’s a little outside the box, maybe even parked next to a taco truck, I am so  here for it. Let’s make something that feels like you .
I&#x27;m officially making it my mission to convince more couples to ditch the traditional engagement session and instead document what they actually love doing together. Whether that&#x27;s slurping noodles, hitting up food trucks, or whatever feels true to your relationship.

## google reviews (top 3)
- (5★ 2026-06) Kalen is the most talented photographer in the Denver metro area, full stop. What makes her the best is not just her tactical skills (eye for details, great angles, creative locations and photo framing) but her genuine enthusiasm and care for the clients. She's authentic, loves what she does, and is unbelievably encouraging and good at directions when she wants you to pose. I'm someone who feels a
- (5★ 2025-10) Hard to put into words how phenomenal it is to work with Kalen and her team. They are truly the best to do it. Not only do they guide you through every step of the wedding photo journey, but they do it with an immense amount of care and intention. It’s such a personal decision to pick out a wedding photographer — you spend all day with them! And I couldn’t be more grateful we went with Kalen and h
- (5★ 2026-05) Kalen is incredible!! We had her as our photographer for our wedding, and we can't say enough just how amazing she was. She was so helpful during planning, was very accommodating to our requests, and all of the photos she took look phenomenal. We are so happy we chose her, and we cannot recommend her enough!

=== PHOTOGRAPHER: Kara Cavalca Photo+Video | vendor_id=ad7d1748-347d-4110-8d0b-fa7364e70be4 | bot=bot4 | date=12/2025 ===
# Kara Cavalca Photo+Video (Durango) — vendor_id=ad7d1748-347d-4110-8d0b-fa7364e70be4
site=http://www.karacavalca.com/ | google 5★ × 90

## site pricing/package lines
Photography and videography are the longest lasting investments you can make in your wedding day. Therefore choosing your photographer and videographer are the most important choices you make when planning your wedding day.
I know your imagery it is quite the investment,
Full day weekend wedding packages start at $4000 for 6 hours.
Hourly rates are available for weekday weddings.
durango elopement photographer
elopement photographer in durango
elopement photographer in telluride
telluride elopement photographer
ouray elopement photography
Engagement photos come complimentary with all wedding packages!
I believe having an engagement session with your wedding photographer is so key for multiple different reasons.
Your engagement session will come with...
You can find engagement session pricing for sessions outside a wedding package HERE ,
but if you end up booking your wedding with me that price will be deducted from your deposit fee.
I never want to make my clients feel the way I did with our second photographer. I strive to be like our first photographer. I want my clients to walk away feeling that they had a great experience and that I helped add to their story and capture it in the best way for them.
Colorado Elopements | Kara Cavalca Photo
In an elopement, YOU make the rules.
pdf rate cards seen on site (not fetched): https://www.karacavalca.com/_files/ugd/8ecfd3_c33011dcdead4e39a178ac8cbd2a082a.pdf

## google reviews (top 3)
- (5★ 2024-10) Kara is an all around amazing human! I have much love for her and the work she does! I appreciate how personal she was with us from the start. I had other photographers feel stale, quick to throw a contract at me. Never once did I feel pressured about booking my date with her or feel uncomfortable at any point! Kara was a big help to me with details for the day of. She has the questions and recomm
- (5★ 2024-07) We had so much fun working with Kara for both our engagement photos and for our wedding. Not only is she the best photographer we’ve ever seen, but she is an incredibly kind, thoughtful, and funny human being. She continuously went above and beyond to make sure that she captured everything we wanted, to answer random wedding questions, and to ensure we didn’t miss a detail of all the important par
- (5★ 2025-10) Kara is truly a gem, by far the best photographer I have ever worked with, and the best vendor we chose for our wedding. She truly made my husband and I feel at home from the get-to-know-you engagement shoot to the end of our wedding day. She was so helpful beyond just photos, helping me with my veil and other little things throughout our day. She is so kind and charismatic, and also incredibly or

=== PHOTOGRAPHER: Kari Geha Photography | vendor_id=01c76481-ac5a-43e0-b559-d3be88ba896b | bot=bot5 | date=7/2025 ===
# Kari Geha Photography (Denver) — vendor_id=01c76481-ac5a-43e0-b559-d3be88ba896b
site=http://karigehaweddings.com/ | google 5★ × 16

## site pricing/package lines
See below for pricing!
Up to 8 Hours of Coverage
wedding collection gold | $5750
Wedding Collection Silver | $5500
Wedding Collection bronze | $5250
wedding collection hourly | $75o/hour
Hourly Coverage (4 hr min on weekends)
elopements | STARTING AT $3000 (Weekends)

## google reviews (top 3)
- (5★ 2025-11) Kari truly lives up to her reputation. Not only is she one of the most incredible Wedding photographers, she's also such a beautiful and kind soul. I had a lot of questions during our wedding planning process, and she was so helpful with answering all my questions in a timely manner, but also making life easier for me as the bride. When she showed up for our wedding day, she brought the energy, pr
- (5★ 2025-10) I cannot say enough wonderful things about Kari! We booked her for our engagement and wedding photos and we couldn’t be happier. My fiance and I are not particularly camera people lol but she made us feel so comfortable, light, and happy with the photoshoot process. We really wanted to enjoy as much of our wedding as we could without being carried away for photos for a long time. But because she i
- (5★ 2024-07) Where do I even start, Kari was such a delight to work with!! We hired her for our June 8, 2024 wedding at blanc in Denver. My husband and I had never been in front of a professional photographer and she made us feel so comfortable. She had a great energy, worked well with our families, and was fun and creative with her shots. I’ve only seen the photo preview so far but I’m OBSESSED. She has a spe

=== PHOTOGRAPHER: Karla Wedding Photography | vendor_id=62eb80ab-408a-45ac-9974-c8038b5d0ab8 | bot=bot6 | date=3/2026 ===
# Karla Wedding Photography (Durango) — vendor_id=62eb80ab-408a-45ac-9974-c8038b5d0ab8
site=http://karlaweddingphotography.com/ | google 5★ × 4

## site pricing/package lines
investing in your memories
collection 1 - $2,000
collection 2 - $3,000
Collection 3 - $3,600

## google reviews (top 3)
- (5★ 2020-10) She is so amazing at what she does! All of my friends except for the one that recommended her to me have been a little disappointed with their photos and they paid so much more for their photographer. She is extremely professional yet warm, and I couldn't be happier with the pictures that she took. She really captured the day and just made it even more special. And also she completed editing and t
- (5★ 2021-06) Karla was the photographer for my outdoor mountain wedding. The photos from the day are amazing and we are so grateful for her work on them. She worked hard getting such a variety of pictures and communicated well with us before, during, and after. Beyond her great photography skills, Karla was kind, warm, and so pleasant to work with! I'd definitely recommend her. Thank you, Karla!
- (5★ 2019-11) Beautiful photographs. I have done several projects with Karla Benitez Wedding Photography and the result is always better than expected. I highly recommend Karla Benitez.

=== PHOTOGRAPHER: Katie Corinne Photography | vendor_id=d011ba53-cfe1-416a-9f62-55af4451889f | bot=bot7 | date=7/2025 ===
# Katie Corinne Photography (Monument) — vendor_id=d011ba53-cfe1-416a-9f62-55af4451889f
site=http://katiecorinne.com/ | instagram=@katiefletcher_photography | google 5★ × 29

## site pricing/package lines
Whether we are your surprise proposal photographer, plan your engagement portraits or just your intimate elopement or destination wedding, there's no where else we'd rather be.

## google reviews (top 3)
- (5★ 2018-09) Katie was hands down everything we could have asked for in a wedding photographer. I don't think we could have made a better choice! :) Katie had great communication, a positive and encouraging attitude, was timely and professional, and of course had amazing photos!! We love, love, love both our engagement photos and our wedding photos. We felt like her priority and that she really paid attention 
- (5★ 2019-06) She did an amazing job! She was fun to work with, made everyone feel at ease and was practically invisible during the ceremony and reception (literally had all of the planners trying to find her right before I (the bride) walked down the aisle). She was just being so sneaky getting amazing shots that they couldn't see her which is exactly what you want from a photographer. Her work is amazing. She
- (5★ 2026-02) We’ve had the pleasure of seeing Katie Corinne Photography in action at several weddings, and she is incredible. Katie is professional, creative, and has a true gift for capturing both the big moments and the small, intimate details that make each wedding unique. She communicates clearly and keeps everything running smoothly, which makes collaborating with her effortless and enjoyable. Any couple

=== PHOTOGRAPHER: Kelly Miranda Photography | vendor_id=6a7146fb-0180-490d-956d-23970b461b98 | bot=bot8 | date=8/2025 ===
# Kelly Miranda Photography (Durango) — vendor_id=6a7146fb-0180-490d-956d-23970b461b98
site=https://www.kellymirandaphotography.com/ | google 5★ × 129

## site pricing/package lines
Schedule an initial phone call or video chat to go over pricing and wedding details
Book your wedding photography package on Kelly’s website
Wedding Photography Packages
1 photographer (add 2nd for $150 per hour)
Add an 8x8 album for $850 or 10x10 album for $1100
Add an Engagement Session for $450
8x8 album (upgrade to 10x0 album for $250)
Elopement and Intimate Wedding Packages
Why is an engagement session so important?
An engagement session is a pivotal step in your wedding journey.
Engagement Session Pricing
• Your Choice of 5 digitals OR $350 in prints
Engagement Session when added to Wedding Package
How do we reserve our date with you? Is there a deposit?
I usually deliver between 50-75 photos per hour of photography.
Schedule an initial phone call to go over pricing and session details
Should I wait until my kids are a older before investing in a professional portrait?
The first step would be to fill out the contact form here and I will get in touch with you. You will receive an email with a link to my print and product pricing guide as well as a link to schedule your initial phone call so we can get the planning started.
Canvas gallery wrap, framed print, heirloom album, or metal print? Don’t limit yourself to a 5x7 that gets shoved in a drawer and never seen again! You Deserve the Wall art! Kelly Miranda Photography is Durango, Colorado’s best photographer for high-quality art that you will cherish for a lifetime.
Check out the different products Kelly Miranda Photography offers, from albums to wall art, and everything in between, there are so many beautiful ways to preserve your memories and enjoy them every day in your home.

## google reviews (top 3)
- (5★ 2026-04) Kelly Miranda Photography stands out as one of the most inviting and professional photography businesses in Durango, Colorado. Her website beautifully showcases family photography, newborn photography, maternity portraits, weddings, and headshots, and her style feels natural, emotional, and timeless. You can tell she truly cares about families and about creating artwork people will treasure for ye
- (5★ 2024-06) Kelly did an outstanding job recently at my son's wedding in New Jersey. Not being familiar with the hotel or venue, she arrived early to scope out the best places to take pictures. The pictures at the venue are so beautiful! She captured the day perfectly! She took every picture we asked and more. She was very professional but made sure everyone was comfortable and enjoying the event. She is a ve
- (5★ 2025-01) If you're looking for a Durango family photographer, Kelly is incredible! We were wanting to do the "awkward JCPenney studio family portrait" trend, and her photos turned out even better than we could have hoped! I was so scared a photographer wouldn't take on such an unserious shoot, but she openly accepted, embraced, and made our concept even better. Our friends came in from all over the country

=== PHOTOGRAPHER: KiKi Creates | vendor_id=c6448110-5ab1-4703-a0ae-a85d2802c0fd | bot=bot9 | date=2/2026 ===
# KiKi Creates (Crested Butte) — vendor_id=c6448110-5ab1-4703-a0ae-a85d2802c0fd
site=http://www.kikicreates.com/ | google 5★ × 30

## site pricing/package lines
Home About INVESTMENTs portfolio faqs contact
If you want a full day of coverage for something like an Elopement I would recommend at least four hours. For a wedding I would recommend between 6 to 8 hours of
-Will you help scout beautiful locations for our wedding or Elopement?
home about portfolio investments journal
Colorado Wedding & Elopement Photography | Kiki Creates
Loved, loved, loved this experience. Kiki did the photos for our elopement. She was easy to work with. We are very please with the way the photos turned out. We could not ask for a better elopement experience.
Wedding & elopement photographer and filmmaker, rooted in Crested Butte — available everywhere. Now booking 2026 & 2027.
Crested Butte Elopement Photographer
A complete guide + a photographer who helps you plan every step of your adventure elopement.
Best Locations for Elopements in Crested Butte
Crested Butte elopement photography is about more than just images—it’s about what those moments hold onto over time. In Crested Butte, where landscapes feel both vast and intimate, your story deserves to be captured with intention, emotion, and honesty.
Even the most intimate elopement can benefit from a few key people in your corner.
Crested Butte Elopement Packages & Experience
Your elopement isn’t just about photos—it’s about creating an experience that actually feels like you.
As a Crested Butte elopement photographer, I don’t just show up with a camera. I help you craft a day that’s intentional, stress-free, and rooted in everything you love about being together—whether that’s hiking to an alpine lake, chasing wildflowers, or keeping things simple and intimate.

## google reviews (top 3)
- (5★ 2026-03) We cannot recommend Kiki highly enough! From our very first conversation, she was incredibly thorough in her prep work, asking thoughtful questions about our vision, timeline, and the vibe we wanted to capture. She made us feel completely at ease throughout the entire process. On the day of, Kiki was punctual, professional, and somehow managed to be everywhere at once without ever feeling intrusiv
- (5★ 2026-01) We cannot say enough amazing things about Kiki Creates and Kara! She photographed both our engagement session and our wedding, and every single photo is absolutely stunning. Kara is professional, organized, and so easy to work with—she made us feel completely comfortable in front of the camera from day one. On our wedding day, she captured every special moment, big and small, so beautifully and na
- (5★ 2026-02) Kiki is an exceptional photographer with a distinctive vision and genuine passion for her craft! She beautifully captured our wedding day, and we were so thrilled that we asked her to photograph our maternity shoot as well. She has a gift for personalizing each session while helping us feel completely natural and authentic. My husband and I absolutely love every single photo she has taken! Highly,

=== PHOTOGRAPHER: Kimi D Photography | vendor_id=7d0293cb-ca36-4f31-96a2-b1b132d16f5a | bot=bot10 | date=1/2025 ===
# Kimi D Photography (Vail) — vendor_id=7d0293cb-ca36-4f31-96a2-b1b132d16f5a
site=http://www.kimidphotography.com/ | google 5★ × 45 | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2026-06) Kimi was absolutely amazing from start to finish. From the beginning, I was honest with her that I was considering multiple photographers for our engagement, and the way she handled that immediately stood out to me. When I mentioned another photographer I was looking at, she didn’t put them down at all. In fact, she spoke highly of them and simply explained that their style was different from hers
- (5★ 2023-08) My husband I absolutely loved working with Kimi. Kimi did both our engagement and wedding photos and they all turned our incredible. Kimi was communicative and helped us get all the photos we wanted. She helped us pose, and kept us laughing. I had multiple people from my wedding tell me how much they loved our photographer and the presence she brought to the wedding. She captured all the details t
- (5★ 2025-06) Kimi is a delight to work with; a true professional from start to finish of the photo process. This is my 4th project I’ve done with her and would 10/10 recommend her for couples, weddings, engagements, family portraits, and seniors. She makes you feel at ease the moment she meets you and helps you forget the camera is even there. A great talent in the Eagle River Valley, and I look forward to wor

=== PHOTOGRAPHER: Leah Goetzel Photography | vendor_id=5c9467c9-1617-495b-a5db-2524d3c5ddfd | bot=bot11 | date=1/2025 ===
# Leah Goetzel Photography (Denver) — vendor_id=5c9467c9-1617-495b-a5db-2524d3c5ddfd
site=http://www.leahgoetzel.com/ | instagram=@leahgoetzel | google 5★ × 76 | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-09) As my husband and I prepared to plan our wedding, one of our first priorities was to find a photographer who could capture the joy of one of the most important days of our lives. Leah was the first (and only) photographer we spoke to, and we knew during our first meeting she would be the perfect person capture our day! Leah radiates positive and calming energy. This made our engagement and wedding
- (5★ 2025-11) Leah is first of all an amazing human being, and additionally an exceptional wedding photographer. From the first time we spoke with her, it felt like working with a friend to make our dream a reality. Even though all of the planning happened from different time zones, Leah was always available and approachable to help us plan out our elopement and help us work through the logistics. Leah literall
- (5★ 2025-09) Leah is truly amazing to work with and her photos are absolutely stunning. We cannot recommend her enough! We were initially drawn to her beautiful portfolio when searching for a wedding photographer, and after meeting her, we knew instantly she was the perfect fit. Throughout the planning process, Leah was incredibly supportive, always available to answer our many questions with patience and care

=== PHOTOGRAPHER: Light in Motion Co | vendor_id=659ba76f-88e1-4572-8350-9a22ca5bf3da | bot=bot12 | date=11/2025 ===
# Light in Motion Co (Telluride) — vendor_id=659ba76f-88e1-4572-8350-9a22ca5bf3da
site=http://www.jasonanddaris.com/ | google ?★ × ?

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: Lisa Marie Wright Photography | vendor_id=6a28df0b-b5e2-4c4f-b3e5-44e681df709c | bot=bot13 | date=10/2025 ===
# Lisa Marie Wright Photography (Telluride) — vendor_id=6a28df0b-b5e2-4c4f-b3e5-44e681df709c
site=https://lisamariewrightphotography.com/ | google 5★ × 322

## site pricing/package lines
Reach out to begin planning a photography collection worthy of the beauty and emotion of your Colorado mountain wedding.
VI. CONTACT V. JOURNAL IV. Engagements III. Elopements II. weddings I. About find your way around
CONTACT JOURNAL Elopements Weddings MEET home find your way around
High-resolution images & print-ready files: For albums, walls, and keepsakes.
Second photographer or assistant: Ensures every angle, detail, and guest reaction is documented.
Customized Wedding collections: Tailored to your wedding’s aesthetic, timeline and needs.
Whether you’re planning an intimate elopement or a multi-day destination wedding weekend, your experience is handled with care, professionalism, and artistry.
Once you’ve chosen your date, I’ll send over a proposal with your custom package details and a booking link. A signed contract and a 40% retainer officially reserve your date — and then the fun begins as I plan your timeline and photography details together.
Intimate Elopements, Elegantly Captured
From intimate elopements to mountaintop ceremonies at San Sophia Overlook, Gorrono Ranch, The Peaks Resort, and Palmyra Lookout, I create imagery that reflects the emotion, beauty, and meaning of your day.
From intimate elopements to refined multi-day celebrations, my work is inspired by the natural grandeur, light, and sense of place that make Telluride weddings so unforgettable.
With thoughtful, precise direction, I help my couples feel confident and present, allowing authentic emotion and refined beauty to unfold naturally. Paired with my signature light and airy aesthetic, the result is a timeless collection of images crafted for those who value legacy as much as beauty.

## google reviews (top 3)
- (5★ 2025-10) The Best Decision We Made for Our Wedding If you are looking for a wedding photographer, stop your search and hire Lisa. She is without a doubt one of the BEST decisions we made for our wedding. My husband and I are from Atlanta, GA and planned a destination wedding in Telluride, which was both exciting and overwhelming. I knew I wanted someone who not only took beautiful photos but also made the 
- (5★ 2025-10) My wife and I can’t say enough wonderful things about Lisa Marie Wright!! She is not only an amazing photographer, but she is an incredibly nice and helpful person! All throughout the process if we asked her for input on things we were trying to decide between, she would provide helpful feedback, and even made additional suggestions that saved us time and money in the end. She was also very calm a
- (5★ 2025-09) We couldn’t be happier with our experience working with Lisa as our wedding photographer! From the very beginning, she was incredible to work with — professional, kind, and so easy to communicate with. Lisa responded quickly to messages, kept us informed throughout the process, and was always accommodating, even with our last-minute additions and changes to the schedule for different photo shoots.

=== PHOTOGRAPHER: Lone Oak Studio, Inc | vendor_id=750392e0-7b46-4fca-89ac-217594b41b49 | bot=bot14 | date=9/2025 ===
# Lone Oak Studio, Inc (Steamboat Springs) — vendor_id=750392e0-7b46-4fca-89ac-217594b41b49
site=https://www.loneoakstudios.com | instagram=@lone_oak_studios | google ?★ × ?

## site pricing/package lines
Basic wedding day coverage starts at $2,200. Most couples typically invest between $3,500 - $5,000 for their collection. We can work with you to design a custom collection that fits your needs. Portrait Sessions are available from $550. Event coverage starts at $275/hour.
Investment | Lone Oak Studios
OUR SERVICES & PRICING
We offer a number of options for our couples. Comprehensive wedding packages start at $2,750 but we do offer customized options for smaller weddings.
Families, Engagements, Seniors, Anniversaries, and more. Our style is inspired by real life and natural light. Portrait packages are available from $650.
WEDDING PACKAGES & OPTIONS
The only thing that you will take home with you at the end of the day is your love for one another and your photographs. That’s why we believe that your wedding photography is the only true investment you will make when it comes to paying for your most special day.
Every wedding is unique. We offer a variety of packages designed to fit a variety of needs.  If one of these packages doesn&#8217;t quite fit your needs, don&#8217;t be afraid to reach out to us. Perhaps we can customize a package that works for you!
Mini Wedding Packages
Up to 6 Hours of Coverage, 2 Photographers, an Online Gallery of Your Images, Download & Printing Rights, and a credit towards a Signature Album.
An Engagement Session can be added at a discounted rate.
Up to 8 Hours of Coverage, 2 Photographers, an Online Gallery of Your Images, Download & Printing Rights, and a credit towards a Signature Album.

=== PHOTOGRAPHER: Lucky Penny Event Planning | vendor_id=a5140245-bf71-488b-8179-64c309f5dfbb | bot=bot15 | date=5/2026 ===
# Lucky Penny Event Planning (Crested Butte) — vendor_id=a5140245-bf71-488b-8179-64c309f5dfbb
site=http://luckypenny.events/ | google 5★ × 90

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-12) We cannot say enough good things about Lucky Penny and our planners, Kaitlyn and Ciera. Picking a wedding planner can feel so intimidating, and though we met with 8-10 different planners, Lucky Penny immediately stood out for their willingness to engage in the uncertain and bring to life unique ideas for a wedding. They’re a dynamic duo; Ciera is truly a design visionary, and Kaitlyn is incredibly
- (5★ 2025-12) Where to even start! Ciera and Kaitlyn are the absolute best! When we decided to have our wedding in Crested Butte, every person told us to hire Lucky Penny, and it was the best decision we made as we planned our perfect day! They were super on top of all of our deadlines, emailing vendors, setting check ins, and helping us to navigate the possibly overwhelming number of details that a wedding ent
- (5★ 2025-10) Lucky Penny did an amazing job with Marissa and I's wedding. We were in planning for just over a year and everything on wedding day went off without a hitch. We did a multi-location wedding day with our ceremony location separate from our reception and they helped plan transportation between both locations and had both sites setup amazing. They helped with all arrangements with Bartending, Caterin

=== PHOTOGRAPHER: Lyndsey Leach Photography | vendor_id=610c2233-0c42-48f5-b4a5-a4a9d2ce2058 | bot=bot16 | date=12/2025 ===
# Lyndsey Leach Photography (Lakewood) — vendor_id=610c2233-0c42-48f5-b4a5-a4a9d2ce2058
site=https://www.lyndseyleachphotography.com/ | google 5★ × 59

## site pricing/package lines
Get in touch with me ASAP! I will send you a contract and a payment request for the retainer. Once I receive the signed contract and the retainer, the date and time(s) are yours!
Yes! All returning customers receive $50 off their next booking.
Additionally, I offer referral discounts as well! If you refer someone to me and they book a session with me, you will receive $50 in print credit from me. If you refer someone for an elopement or a wedding and they book with me, you will receive $100 in print credit from me.
I also offer a green discount . I will take $50 off of your session total if we are all able to take alternative modes of transportation to and from the session. i.e. If I can walk or ride my bike and vice versa!
I will share some sneak peeks within 3 days following your session. Lifestyle Packages take 2-3 weeks for processing; Engagements/Couples and Boudoir take 3-4 weeks, and Weddings/Elopements are closer to 4-6 weeks.
As for prints and albums, I usually say anywhere from 3 &#8211; 6 weeks. There are a lot of variables so it is tough to give a better estimate than that. If I think that something might take longer, I will let you know before I make the order.
I’ll go anywhere! I LOVE to travel! Please email or call me with more details. Cost will be a case by case basis. Travel within 30 miles of Denver is included in every package.
Investment - Lyndsey Leach Photography
Photography Collections
Once we get all the details squared away, I will send over a contract along with a Quickbooks invoice for the retainer. Once I get the signed contract and retainer payment, the date/time is officially yours and we can start planning.
pdf rate cards seen on site (not fetched): https://static1.squarespace.com/static/58fa9e7859cc687735e3d355/t/63a36e08e664f1536c93a944/1671654922463/2023+Elopement+Packages+.pdf

## google reviews (top 3)
- (5★ 2023-01) As a vendor, we have worked with Lyndsey doing weddings and boudoir. Her communication, timeliness, organized being makes our job performance with ease. She’s great at what she does and it reflects in the end product. She’s also great at sharing work and keeping vendors in the loop which can be hard for some photographers and us as artists. All of this leads to my personal relationship with Lyndse
- (5★ 2023-02) Lyndsey is an incredible photographer, expert herder of wiley wedding subjects, and wonderful person. She photographed our wedding party. We only really wanted a select few shots including couples shots, family photos ,and some candid shots from the event. I was so impressed by Lyndsey's ability to wrangle a large group of folks and manage posing/smiles/environment to get a great shot. I was amaze
- (5★ 2022-09) As a wedding planner, I've worked with Lyndsey on many different occasions. She's reliably kind, timely, professional, funny, and personable. Her photos always far exceed my expectations. She really cares about taking care of the planet and advocating for social justice, and this is reflected in every area of her business. I will always recommend her to any of my couples, without reservation!

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-09.csv
