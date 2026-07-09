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


=== PHOTOGRAPHER: Studio kiva photography | vendor_id=46bcbd77-c1e4-44f9-9a1a-422ac49cf6b5 | bot=bot11 | date=6/2025 ===
# Studio kiva photography (Breckenridge) — vendor_id=46bcbd77-c1e4-44f9-9a1a-422ac49cf6b5
site=https://studiokivaphoto.com/ | google 5★ × 13

## site pricing/package lines
We offer Professional Photography Packages, Aerial Video, Aerial Photography, Videography, and Matterports, to just name a few. Stock photography is also a big part of our business and adds a little something that is out of the ordinary.
Products & Price Brochere Coming Soon

## google reviews (top 3)
- (5★ 2025-08) Katie Girtman of Studio Kiva Photography is a true gem! Her work is absolutely top-notch — the image quality is outstanding, and her artistic eye brings every shot to life. Beyond her technical skill, Katie is incredibly personable, warm, and easy to work with. She creates a relaxed atmosphere that makes the entire process enjoyable from start to finish. Her pricing is more than fair for the excep
- (5★ 2025-08) Katie rocks! She’s an incredibly talented photographer with a great eye and a warm, down-to-earth personality. The quality of her work is outstanding, and she made the whole experience fun and easy. Excellent service from start to finish — highly recommend!
- (5★ 2025-08) Katie was incredible for our engagement photos! She is professional, timely, and a great photographer. Our pictures turned out so well! She is also a warm, fun, and nice person who was a pleasure to shoot with!

=== PHOTOGRAPHER: Sunbeam Studio | vendor_id=149a7518-72f2-4a1d-938b-4256c1f2409b | bot=bot12 | date=1/2026 ===
# Sunbeam Studio (Louisville) — vendor_id=149a7518-72f2-4a1d-938b-4256c1f2409b
site=https://www.sunbeamhairstudio.com/ | instagram=@sunbeamstudio.photo | google 5★ × 279

## site pricing/package lines
As a session salon , gratuity is no longer expected (but always appreciated!) and all prices are transparent - no more add ons or guessing. All stylists charge a set hourly rate and do not double book which allows them to give you their full attention and energy.
Please check our booking system to see pricing for specific stylists and their services!
Our participation in the Green Circle Salons program requires an investment in specialized waste management systems and practices. The tax supports this partnership, enabling us to adhere to stringent sustainability protocols.

## google reviews (top 3)
- (5★ 2026-02) Where do I start my glowing review for Sunbeam Studio. First, April, the owner, is incredibly talented, along with just about every stylist in the salon. My current stylist, Kenzie, is unfortunately moving, but I don’t hesitate to switch as I know every stylist here is gifted. They crush blonde highlights, excel at gray grow out (I am in this category), extensions, cuts, and so much more. April ha
- (5★ 2025-12) Sierra at Sunbeam is THE BEST! After moving to Colorado, I was having such a hard time finding a stylist that not only understands what I am asking for, but is actually able to get there. After 2 appointments with other stylists in Denver, I finally was recommended to Sierra. From day 1, I have been so happy with my hair color and extensions! I feel like a bestie in her chair, and Sunbeam is the c
- (5★ 2025-12) After many years with the same stylist that was a long drive I switched to Sunbeam. I’ve seen several of the stylists here and had great experiences with each. Everyone here listens closely to what you want and results are natural and long lasting. Techniques are gentle on your hair and have helped with my hair health. There are always ongoing improvements to the salon itself, which is such a calm

## region pricing digests
- [launchintel] Sunbeam Studio | Kelsey; also destination

=== PHOTOGRAPHER: Tayler Carlisle Photography | vendor_id=4ac63ceb-186b-4153-b953-e4b5b508f711 | bot=bot13 | date=2/2026 ===
# Tayler Carlisle Photography (Evergreen) — vendor_id=4ac63ceb-186b-4153-b953-e4b5b508f711
site=http://www.taylercarlisle.com/ | google 5★ × 29

## site pricing/package lines
Investment &mdash; Tayler Carlisle Photography
Home About Portfolio Boudoir Lifestyle Investment Contact
Elopement Coverage starts at
*Average investment is around $5800
Any where in the continental USA, outside of Colorado - Starting at $5500
Hawaii & Alaska - Starting at $6000
Mexico & Central America - Starting at $6000
Europe - Starting at $7000
Africa, Australia & South East Asia- Starting at $8000
Home Portfolio Investment Lifestyle Blog
Browse by Collection
Consider Customization : If you’re looking for a custom or couture gown, that will add to the cost. However, it could be worth the investment if you're looking for something unique.
Engagement Sessions &mdash; Tayler Carlisle Photography

## google reviews (top 3)
- (5★ 2024-10) Tayler was so amazing to work with for our wedding. I really really appreciated how our package included an engagement shoot, not just because the pictures were amazing but also because it was really nice to get to know her and see her work in all its glory in advance. I went into my wedding KNOWING the pictures would be stellar. Not only does she produce great work, but something I was worried ab
- (5★ 2024-07) Tayler is the best! I am so so so happy I hired her for my wedding. She has a beautiful way of capturing movement, emotion, and color into her photos. I think a big part of why her photos turn out so well is because of how comfortable you feel around her. She has a very warm and sweet energy. My husband was super nervous about taking photos and has never been super comfortable in front of the came
- (5★ 2025-09) Tayler + her camera = GOLD! From our engagement session to our wedding day, she absolutely crushed it! She had wonderful recommendations on places for our engagement shoot, and made us feel comfortable in front of the camera. She brought a fun, laid-back energy that made taking photos enjoyable, answered all of our questions, and had great organization to make sure we got all of the shots we wante

=== PHOTOGRAPHER: Taylor Mitchell Photography | vendor_id=149308b2-7f62-445c-bd73-4fa3b86d1f90 | bot=bot14 | date=2/2025 ===
# Taylor Mitchell Photography (Telluride) — vendor_id=149308b2-7f62-445c-bd73-4fa3b86d1f90
site=http://taylormitchellphotography.com/ | google 5★ × 3

## site pricing/package lines
Pricing + Info &mdash; Taylor Mitchell Photography
Blog Meet Taylor PRICING + INFO Contact
PRICING + INFORMATION
-Assistance in planning and guidance for your elopement
Loves when intimate weddings and elopements end with dancing the night away under the stars!

## google reviews (top 3)
- (5★ 2018-09) Taylor went above and beyond expectations for our wedding weekend in August. She wanted to be at every part of the wedding including the rehearsal dinner, the venue walkthrough, the ceremony rehearsal, etc. She made it a priority to get the to know us as well as all of our family and friends. She spent a day with us taking beautiful pre-wedding photos instead of engagement photos and included our 
- (5★ 2020-03) I could say a million positive things about Taylor. Not only is she an incredible photographer, but she is an incredible person. She is professional, personable, and makes you feel comfortable being in front of her camera (which can sometimes be uncomfortable for people). Taylor shot our engagement photos in Sedona and our wedding in Keystone, CO. She always scouts out great locations with incredi
- (5★ 2019-07) Taylor created a whole experience for us!! She met us in Iceland and travelled happily and peachy in close quaters with us for 12hrs and I have the pleasure to say I'd do it all over again in a heartbeat!! She's an amazing photographer with great vision and instructions. She won't leave ya hanging, she makes it fun, comfortable, and she goes above and beyond as a photographer and a person!! Highly

=== PHOTOGRAPHER: Telluride Presents | vendor_id=cdb31dcf-5dd3-4604-ad65-9d37260a91e7 | bot=bot15 | date=2/2026 ===
# Telluride Presents (Telluride) — vendor_id=cdb31dcf-5dd3-4604-ad65-9d37260a91e7
site=https://bit.ly/3PmYXI9 | google 5★ × 81

## site pricing/package lines
We understand that every couple is unique, and we tailor our services to meet your specific and authentic needs. Whether your wedding is large or small, we ensure it’s personalized to reflect your style. We offer flexible pricing options, making it easy to fit your budget.
We take the time to get to know you as a couple, understanding your passions and how to incorporate them into your wedding day. After learning about your vision, we’ll send you detailed pricing and services tailored to your needs.

## google reviews (top 3)
- (5★ 2026-04) We couldn't have asked for a more thoughtful and organized wedding planner to bring our mountain wedding vision to life! Kathleen of Telluride Presents made the entire experience feel genuinely enjoyable. From day one, Kathleen was organized, responsive, and began moving everything forward. She took the time to understand exactly what we wanted and then elevated it in ways we never would have thou
- (5★ 2025-03) Kathleen was truly a pivotal part of our wedding, and there's no way we could have pulled off this very logistically complicated wedding without her (aka a winter wedding at Gorrono Ranch, which included snowcats to move ourselves & guests up and back down, having our dogs in the ceremony, having an Oxygen bar, limited window to set everything up, all the works). Having lived in Telluride for over
- (5★ 2026-03) As the mother of the bride, I cannot say enough wonderful things about Kathleen. From our very first conversation, she felt more like a friend than a wedding planner—warm, approachable, and genuinely invested in making this experience special for our family. She guided us every step of the way with such ease and confidence. She was incredibly proactive, often reaching out with thoughtful ideas and

=== PHOTOGRAPHER: Telluride Ski Resort Weddings & Events | vendor_id=df7f5a6f-5cf3-42c9-b219-6ce5dbf8fb3c | bot=bot16 | date=5/2026 ===
# Telluride Ski Resort Weddings & Events (Mountain Village) — vendor_id=df7f5a6f-5cf3-42c9-b219-6ce5dbf8fb3c
site=https://www.tellurideskiresort.com/weddings/ | google 4.9★ × 20

## site pricing/package lines
(none found on site)
pdf rate cards seen on site (not fetched): https://tellurideskiresort.com/wp-content/uploads/2020/09/tsg_2017_master_development_plan.pdf

## google reviews (top 3)
- (5★ 2025-03) The Telski wedding team was fantastic to work with! We primarily worked with Tiffany, who is a gem, but each person we met with as part of the larger wedding planning process was extremely considerate, kind, professional, and responsive! This past Summer, we had a very fun wedding tasting up at Gorrono Rach to talk through all the possibilities and the team made the process such a fun & unique exp
- (5★ 2025-09) Getting married at San Sophia Overlook was a dream come true, and it was made even more special thanks to Jessica and her incredible team. From the very beginning, Jessica was a joy to work with—friendly, professional and always highly responsive to our emails and questions in the months leading up to our wedding. Jessica went above and beyond to accommodate our custom requests, including creating
- (5★ 2025-11) My husband and I had the most beautiful October 2025 wedding at Gorrono Ranch/San Sophia Overlook in Telluride. I remember first inquiring about the venue right after getting engaged, and the team was so excited, helpful, and informative. We worked mostly with Sarah, and she was such a joy to work with. She helped us identify the right venue for our vision, was mindful of our budget, and worked wi

=== PHOTOGRAPHER: The Cheers Company | vendor_id=b735c747-aec5-4054-8f9d-5ef0b5fb42ae | bot=bot17 | date=5/2026 ===
# The Cheers Company (Telluride) — vendor_id=b735c747-aec5-4054-8f9d-5ef0b5fb42ae
site=http://thecheerscompany.com/ | google 5★ × 26

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2024-06) Jonathan was absolutely amazing at officiating our Elopement. His ceremony speech had us laughing, crying and then crying while laughing. He even dressed the part as a "True Texan" since the two of us traveled from Texas to elope in the mountains of Ouray, CO. Having The Cheers Company officiate our elopement felt like having our best friend telling our story. I am so grateful to have had him ther
- (5★ 2024-08) HIGHLY recommend Jonathon! He’s super easy to talk to, his process is stress-free and he creates absolutely beautiful ceremony speeches. We are so happy to have had him with us on our special day. :) No need to be on the fence, book him! Such a great experience and you’ll be happy you did.
- (5★ 2025-06) Jonathon was great! Very easy to work with and kept our small wedding stress free. The personalization in the ceremony was perfect and told our story wonderfully. We couldn’t have asked for anything better. Thank you!

=== PHOTOGRAPHER: The Landing at Estes Park | vendor_id=5aad46f7-0909-43d7-891b-a5177921a84d | bot=bot1 | date=6/2025 ===
# The Landing at Estes Park (Estes Park) — vendor_id=5aad46f7-0909-43d7-891b-a5177921a84d
site=https://www.thelandingestespark.com/ | google 4.8★ × 189

## site pricing/package lines
Our ceremony & reception package
2027 Range of Pricing for Weddings (non-holiday)
High Season (June &#8211; October) $8,100 &#8211; $13,500
Mid-Season (May & Early November) $7,900 &#8211; $10,900
Off Season (Late November &#8211; April) $7,400 &#8211; $9,900
WEDDING PACKAGE INCLUDES:
For reception packages, the use of our large, wood/metal tables and bistro chairs is included.
See the best pricing & choose your dates here!
Our lodging tax rate is only 9.45% as opposed to the 14.45% tax rate found elsewhere in the Estes Valley.

## google reviews (top 3)
- (5★ 2026-03) We had our wedding at The Landing and could not have asked for a better venue or staff. They truly went above and beyond (even staying late the night before our wedding because we had a communication issue and some of our decor was not delivered on time). When some of our floral arrangement trays sprang leaks they were super helpful and helped find materials to help us repair them. The owner, Jen,
- (5★ 2025-08) We loved our stay at the Landing. We stayed in a suite room and it was very spacious, lovely and very clean. There was a microwave and small fridge with freezer. Nice walk-in shower, very updated. The beauty of the property was awesome. Walk out of the room and a few feet away is the river bubbling along the property. It was quiet, peaceful and I loved that it was away from the hustle of downtown.
- (5★ 2025-09) We had our wedding at The Landing Estes Park, and I couldn't have been happier! The venue is truly stunning - it does mountain modern so well and gives such a warm, inviting vibe. We stayed onsite on the wedding night, and it was so nice! Shout out to Jen for being amazing during the whole wedding planning process and being so solid on wedding day! Just her presence made me feel more comfortable a

=== PHOTOGRAPHER: The Pavilion at The Stanley | vendor_id=3f86327f-9280-4caa-a985-bcc74752d666 | bot=bot2 | date=1/2025 ===
# The Pavilion at The Stanley (Estes Park) — vendor_id=3f86327f-9280-4caa-a985-bcc74752d666
site=https://www.stanleyhotel.com/pavilion.html | google 4.8★ × 24

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2023-11) 2023 Bride - 5/5 stars! We celebrated our wedding at the newly renovated Stanley Hotel Pavilion, and it was a fantastic and seamless experience. The wedding department has undergone a revamp, and everyone was genuinely a pleasure to work with! Crystal and Tripp, the venue directors, were unequivocally the best and most responsive team. They maintained a can-do attitude and not only accommodated ev
- (5★ 2019-02) After our original venue closed down due to a fire, we were scrambling to find a new venue for our wedding that was in three months. We will forever be appreciative to the Stanley Pavilion for partnering with us and making our wedding day an unforgettable day in such a breathtaking place. The Pavilion is absolutely stunning venue, with a special fusion between nature and sophisticated, slick archi
- (4★ 2022-05) Although our relationship with the Stanley started off rocky (many problems and miscommunications on their part), everything improved immensely when Crystal began working with us. She did everything she could in order to make sure our day went smoothly. Even though the Pavillion wasn't the reception venue we were promised, it was absolutely stunning. I truly believe our wedding would have not gone

=== PHOTOGRAPHER: The Photography Concierge | vendor_id=2cb8ba91-b326-4d71-867b-a00c011efeb7 | bot=bot3 | date=1/2025 ===
# The Photography Concierge (Edwards) — vendor_id=2cb8ba91-b326-4d71-867b-a00c011efeb7
site=http://www.photographyconcierge.com/ | google 5★ × 42

## site pricing/package lines
We can accommodate elopements, weddings, proposals, and much, much more! Please reach out to us today to book your session in advance!
We offer wedding packages for any client. Every package brings you an amazing photography and videographer to make sure we don’t miss anything on the best day of your lives. We bring our curated style to capture exactly what you want from your day.
Providing the expertise to create and capture all aspects of your special occasions. We offer engagements, elopements, weddings anniversies and much more. We are here to help

## google reviews (top 3)
- (5★ 2023-11) Chris did an incredible job at capturing moments of our first wedding anniversary trip to Avon. He was professional yet genuine and personable from the moment we met. As people who are camera shy, yet critical when it comes to photos, he was able to create natural moments on camera that will last us years to come. If you are looking for someone who excels at what they do and will make you feel as 
- (5★ 2024-08) The entire family very much enjoyed the actual photo session. Chris is excellent at moving quickly, efficiently, and in an engaging manner. He was able to keep our 7 and 9 year old children focused for their individual photos as well as the ones with each other and the family. He uses the latest technology as evidenced by his camera, lenses, and drone. None of this would matter if he did not have 
- (5★ 2023-11) Chris was absolutely amazing! He went above and beyond to accommodate our needs, as we were traveling with our two small children. He took us to some of the best scenic spots at our resort, and made the whole experience really fun and enjoyable. Chris also knew a lot about the local area and was able to suggest dining and activities for us to do during our stay. We are very pleased with how the ph

=== PHOTOGRAPHER: The Scobeys - Colorado Wedding Photography | vendor_id=ea5601c5-4a4d-4db7-bc9a-647d66a13262 | bot=bot4 | date=3/2026 ===
# The Scobeys - Colorado Wedding Photography (Golden) — vendor_id=ea5601c5-4a4d-4db7-bc9a-647d66a13262
site=https://www.thescobeys.com/?utm_source=GMB&utm_medium=Website | google 5★ × 3 | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2022-04) We LOVED working with the Scobeys. From our first meeting through the wedding day, they were kind, honest, and professional. Their pricing was upfront and we never felt pressured to purchase a more expensive package. They asked us lots of questions to get to know us and what our priorities were for our wedding day. They also helped us figure out the timeline for our wedding day. On our wedding day
- (5★ 2023-05) The one thing people told us when giving advice about wedding planning was that they regretted not having a better photographer. We do not share this regret!! The Scobeys are unbelievably good at what they do. This was one area we were willing to splurge a bit, especially when we looked at their website and portfolio, and it was so worth it. Their talent is unmatched. Not only that, they’re so fri
- (5★ 2022-04) Ashley is amazing! She helped our day run smoothly, and made us feel comfortable and confident despite the wedding day jitters. Our pictures are absolutely beautiful, and we even got them back less than 2 weeks after our wedding! I especially liked the way she was able to get so many great candid shots without us even noticing she was there.

=== PHOTOGRAPHER: Third Eye Photography | vendor_id=2fbd6c82-d202-45ef-a3ef-92f3cb8d48f9 | bot=bot5 | date=12/2025 ===
# Third Eye Photography (Crested Butte) — vendor_id=2fbd6c82-d202-45ef-a3ef-92f3cb8d48f9
site=https://www.thirdeyephotographycolorado.com/ | google 4.9★ × 93

## site pricing/package lines
Are you seeking a Crested Butte wedding photographer or elopement photographer who avoids contrived Pinterest poses and overly filtered clichés? Your search ends here .
Colorado is a wonderful spot for elopements. As a Crested Butte elopement photographer I know the endless locations of beauty where we can create the perfect, intimate and special elopement event for you and your loved ones.
If you're planning your wedding or elopement elsewhere, worry not; I'm ready to travel to you !
Show the strength and beauty in your love. I am a Crested Butte wedding photographer capturing weddings, engagements and elopements in a fun and creative way- I am here to tell your story.

## google reviews (top 3)
- (5★ 2026-05) We could not be happier with Third Eye Photography! Rebecca photographed our wedding in Charlottesville, VA, and from start to finish, the experience was absolutely wonderful. She has an incredible ability to make you feel completely at ease in front of the camera — we barely even noticed her presence, yet she captured every special moment beautifully.
- (5★ 2026-05) Best family photographer! Rebecca is such a pro. She’s so good at making everyone young and old feel comfortable taking photos and makes it fun. The time went by so quickly and we were so happy with the photos she took. It was so hard to choose as they were all so special!! Highly recommend working with Rebecca for all of your family photos. You’ll want to create these memories again and again!
- (5★ 2025-02) Rebecca is THE BEST photographer I have ever had! We live out of state and she was so easy to work with and when we met her in person it was even better! She captured our vision perfectly! If you are looking for memories to treasure for a lifetime I HIGHLY recommend Third Eye Photography. I can’t wait to have another session. Thank you Rebecca 💚

=== PHOTOGRAPHER: Thistle and Pine Photography | vendor_id=242d7e7d-0971-41e4-a8e6-dc54edb20aee | bot=bot6 | date=10/2025 ===
# Thistle and Pine Photography (Colorado Springs) — vendor_id=242d7e7d-0971-41e4-a8e6-dc54edb20aee
site=http://www.thistleandpinephoto.com/ | google 5★ × 93

## site pricing/package lines
Investment | Thistle & Pine Photography | Nostalgia Curated Photographer
film & digital pricing
PHOTOGRAPHY IS AN INVESTMENT.
With three inclusive packages to choose from, securing your photographer (after a phone call, if you fancy) is a breeze.
If your wedding doesn't fit in a particular hourly coverage box, custom quotes are available too!
Packages starting at $5,000 , click the investment guide below for more details.
"Mandie captured the most precious moments and details on my wedding day. Every time I look at my photo album, I find new favorites that perfectly reflect the vision I had for my wedding. The care and love she puts into her work can be felt in each photo."
"Mandie is a true artist. She makes expert use of her time and captures details in an authentic yet elevated way. Looking back at our wedding album, we feel like we are right there again&mdash;not glossing through a staged version of it."
While I do love a big wedding with the white tent and wild party- I absolutely adore elopements. I ran away with my husband and we fasted hands on a mountain top in Wales, not telling a soul, and it will forever be one of the most beautiful moments of my life .
While I specialize in Scotland and Ireland elopements, I will go wherever your hearts desire. It will be our little secret .
I thrift vintage photo albums for my couples and handwrite love letters when all is said and done.
Some of my favorite images from times past. Weddings, elopements, couples sessions and even some travel photos that still take my breath away.
pdf rate cards seen on site (not fetched): https://www.thistleandpinephoto.com/_files/ugd/3fbf32_d90c50f0fa184fa18025858447a849f5.pdf ; https://www.thistleandpinephoto.com/_files/ugd/3fbf32_5624f703268b4e69a2bad79e2a26662c.pdf

## google reviews (top 3)
- (5★ 2025-06) As two Massachusetts-based, camera-shy people, Thistle and Pine (Mandie) made all the difference! She is relatable, funny, honest, and gave clear direction in our shoots that made posing less intimidating. Her communication from CO was always amazing as well as when we finally met in person to take photos. Our photos turned out beautiful!! And we got so many compliments—not just on the pictures, b
- (5★ 2025-10) Thistle and Pine is amazing! Within 5 minutes of talking to Mandie on our first phone call… we knew she was the perfect fit for us. Her humor, passion, and creativity were exactly what we were looking for. You are not only hiring a kind and professional person that you will enjoy spending time with on your wedding day… but also a supremely talented artist who has a one of a kind vision! Our photos
- (5★ 2026-05) Hiring Mandie as our photographer was one of the best wedding decisions we made! Her vision is unique and her photos are stunning; they’re exactly what we could’ve hoped for. She captured so many big moments and so many little details beautifully, and her photos really are a perfect representation of our day. We’ve had a ton of fun going through our wedding photos and picking out our favorites, ea

=== PHOTOGRAPHER: Tina Joiner Photography | vendor_id=5cd6ad2a-1f63-422d-9d8d-202413bd4ebc | bot=bot7 | date=3/2026 ===
# Tina Joiner Photography (Colorado Springs) — vendor_id=5cd6ad2a-1f63-422d-9d8d-202413bd4ebc
site=http://www.tinajoinerphotography.com/ | google 5★ × 28

## site pricing/package lines
Based in Colorado Springs, Colorado, and available worldwide. I happily travel for destination weddings, elopements, and sessions—capturing your story wherever it unfolds.
Investment | Tina Joiner Photography
Collections with Tina start at $5,850
Once you're ready to move forward, we'll lock in your date with a signed contract and retainer. From there, your spot is officially reserved, and the planning magic can begin.
($50 Permit Required)
($300 Permit Required)

## google reviews (top 3)
- (5★ 2026-02) Choosing Tina Joiner for my wedding photos was hands down one of the best decisions we made for our wedding — truly. It took me months to find and decide on a photographer because it was the #1 most important thing I wanted to invest in for our wedding — even more than my dress, the venue, or anything else. I love photos and everything they represent — the memories they hold, being able to relive 
- (5★ 2019-01) Simply the best. Tina is the kindest, sweetest, most thoughtful and organized photographer we have ever hired. She is an accomplished photographer. Her photos are incredible; they make you gasp at their beauty. The true test of a small business owner comes when something doesn’t go quite right. Well, I can tell you that Tina handled herself professionally and with expedience in remedying the hiccu
- (5★ 2024-10) I just want to give a huge thank you to Summer. She was amazing. She was so helpful on our wedding day and did so much more than she needed to. She traveled a bit with us to take off-site mountain photos, did what she could to get the best lighting in all of our photos, and she even helped our wedding coordinator bustle my dress. The preview photos we received were absolutely beautiful. If you wan

=== PHOTOGRAPHER: tomKphoto | vendor_id=75e53808-82be-4352-a49b-d2fbad0644f7 | bot=bot8 | date=8/2025 ===
# tomKphoto (Fort Collins) — vendor_id=75e53808-82be-4352-a49b-d2fbad0644f7
site=https://tomkphoto.com/ | google 4.8★ × 26

## site pricing/package lines
BEAVER CREEK WEDDING PHOTOGRAPHER PORTFOLIO & PRICING
BEAVER CREEK WEDDING PHOTOGRAPHER PRICING 2026
Wedding photography in Beaver Creek typically ranges from $2,500 ~ $9,000.
My 7-hour wedding photography package is $3,450 and includes fully edited images delivered within 72 hours . You’ll receive high-resolution images that are ready for printing, sharing, and preserving your wedding day for decades.
“I’m so pleased with the pictures! He got some great angles and captured all the important moments. Very reasonably priced for his great work! Nice guy and actually gets to know you a bit before the big day.” — Fort Collins Bride on WeddingChannel.com
BRECKENRIDGE WEDDING PHOTOGRAPHER PORTFOLIO & PRICING
2026 BRECKENRIDGE WEDDING PHOTOGRAPHER PRICING
KEYSTONE WEDDING PHOTOGRAPHER PORTFOLIO & PRICING
2026 KEYSTONE WEDDING PHOTOGRAPHER PRICING
STEAMBOAT SPRINGS WEDDING PHOTOGRAPHER PORTFOLIO & PRICING
2026 STEAMBOAT SPRINGS WEDDING PHOTOGRAPHER PRICING
VAIL WEDDING PHOTOGRAPHER PORTFOLIO & PRICING
VAIL WEDDING PHOTOGRAPHER PRICING 2026
Wedding photography in Boulder typically ranges from $2,500 ~ $9,000.

## google reviews (top 3)
- (5★ 2019-10) Finding a great photographer to document our wedding day was one of the highest priorities on our list when we started planning the wedding. We spent a lot of time researching and looking at different photographers, and when we found TomK Photo our decision was made! We loved Tom's style of both capturing traditional poses but also capturing all the emotions and moments of the day. Tom was wonderf
- (5★ 2025-11) I am so grateful to have worked with Tom and his team! After our original photographer unexpectedly closed her business just two months before our wedding, I reached out to Tom—and from the very first conversation, he was warm, responsive, and incredibly professional. He immediately put us at ease during what could have been a very stressful time. Working with Tom was an absolute pleasure. He aske
- (5★ 2024-08) We could not have been more happy with Tom and our wedding photos. Tom chatted with us over the phone months before the wedding to help us make sure the timeline of our wedding was going to work well, and he gave us helpful suggestions (since we weren’t working with a wedding planner!) He wanted to know special details of our wedding plans so he knew what to pay specific attention to. The day-of, 

## region pricing digests
- [launchintel] Tom K Photo | Documentary-style coverage; coverage options from 3 to 12 hours, multiple photographers, photo prints, hanging canvas prints, custom wedding books | https://www.tomkphoto.com

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-13.csv
