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


=== PHOTOGRAPHER: Samantha Dixon Photography | vendor_id=74c3e4a8-94d2-41c3-92fa-2852cd23764e | bot=bot16 | date=6/2025 ===
# Samantha Dixon Photography (?) — vendor_id=74c3e4a8-94d2-41c3-92fa-2852cd23764e
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## reddit
--- reddit-03.txt: SOURCE: r/Eloping — "Colorado Photographer Recommendations Please" (posted 1y ago by GypsyDuncan, 2 upvotes, 13 comments)
musclesandmerlot (1y ago): https://www.zoefortuna.com/
We used Zoe for our Sapphire Point wedding! She was very well priced, talented, and super fun to spend the day with.
  GypsyDuncan (OP): Oh she does lovely work. Exactly what i wanted.

CText-9008 (1y ago): Samantha Dixon Photography

redbelliedblacksnake (1y ago, flair Planning): There's a FB group called Colorado Elopements & Microweddings. TONS of photographers in there. I found a super-reasonably priced person!

itsamfruckus (1y ago): https://www.emilymayphoto.com/

=== PHOTOGRAPHER: Spenser C Photography | vendor_id=9e5183bd-2ca2-4632-bacf-800e4beb8847 | bot=bot17 | date=3/2025 ===
# Spenser C Photography (?) — vendor_id=9e5183bd-2ca2-4632-bacf-800e4beb8847
site=none | instagram=@spenser_c_photography | google ?★ × ?

## site pricing/package lines
(none found on site)

## reddit
--- reddit-03.txt: SOURCE: r/Eloping — "Colorado Photographer Recommendations Please" (posted 1y ago by GypsyDuncan, 2 upvotes, 13 comments)

itsamfruckus (1y ago): https://www.emilymayphoto.com/
Emily was worth every single penny. She's an incredible photographer, had the best location recommendations, and made planning our day a breeze. I think we paid around 3k for 2 hours of coverage, but that was including a travel fee for going 5 hours outside of Denver.

abbiemood (1y ago, flair We Eloped!): I'm not sure how much she costs for elopements/weddings, but check out Spenser - she's amazing! https://www.instagram.com/spenser_c_photography

kentgrey (1y ago): If you're open to the rocky mountains in Alberta - I could give you a bunch of suggestions!

GypsyDuncan (OP): Thanks everyone. SO much great information here.

=== PHOTOGRAPHER: Taylor Nicole Photography | vendor_id=095ff032-ba99-45f0-ae6b-db75a479a85f | bot=bot1 | date=4/2026 ===
# Taylor Nicole Photography (?) — vendor_id=095ff032-ba99-45f0-ae6b-db75a479a85f
site=none | google ?★ × ?

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Taylor Nicole Photography | ethereal style; photos noted as shot far away/wide

## reddit
--- reddit-07.txt: SOURCE: r/Denver — "Denver Wedding Photographer" (posted 6mo ago by igotlotioninmyeye, flair Recommendation, 0 upvotes, 42 comments)
  [follow-up]: planner: Weddings by Jay (does day-of coordination). Videographer: Simple Kendyl Productions ("his videos felt like stories"). He'll be at the 5280 Event Society Unbridal Show on the 24th.
  [follow-up]: Just found out my close runnerup choice for photog is relocating to Colorado this summer! Her style is a bit more vibrant, but she's running a special right now for Colorado couples. https://www.instagram.com/thewildphern

igotlotioninmyeye (OP, 6mo ago): Ooooh Amanda!!! I really like her photos!!! 🤞🤞🤞 she has my date available!!
igotlotioninmyeye (OP, 6mo ago): I'm pretty seriously considering Taylor Nicole Photography. [...] My only concern is all her photos seem very far away. I would like them to be a bit closer up.

=== PHOTOGRAPHER: 11:11 Productions Photography | vendor_id=6e8073cc-5d2e-485a-a97d-c9a385bcf6bc | bot=bot2 | date=7/2025 ===
# 11:11 Productions Photography (Boulder) — vendor_id=6e8073cc-5d2e-485a-a97d-c9a385bcf6bc
site=http://www.weddingphotographerboulder.com/?utm_source=LOCAL&utm_medium=ORGANIC&utm_campaign=GMB | google 4.8★ × 13

## site pricing/package lines
“Wow!!!!! We absolutely love the album! It looks fantastic. It was delivered to our work on Thursday, and it had many of our coworkers in tears. They all thought it was the most beautiful album they had ever seen. Corey and I agreed. Thank you so much for your excellent work!”
“We absolutely love the photos! You've definitely surpassed our expectations, although we knew you were good. It's really going to be difficult to pick the album shots!”

## google reviews (top 3)
- (5★ 2016-10) I highly recommend 11:11 Productions Photography. Barb is a fantastic person and a very talented photographer. We couldn't be happier with our engagement and wedding photos. She got every shot we wanted and captured the spirit of the evening perfectly. Best of all, we loved having her around and we heard from many of our guests that they felt the same. Her energy, humor, and professionalism made a
- (5★ 2025-08) Barb absolutely exceeded our expectations as our wedding photographer! She had an incredible eye for capturing the beauty and genuine emotions of our special day. Her warm, personable approach made everyone feel comfortable, and she guided our guests into stunning shots without ever being intrusive. Barb's professionalism and artistic vision shone through in every aspect of her work. We wholeheart
- (5★ 2025-08) Barb did such an amazing job with our wedding. She has a great eye for capturing magic moments and the play of the light. She has a great sense of humor and made everyone laugh as she told us how to pose, turn, and face each other. It was wonderful to have so many images that captured formality, fun, beauty, silliness, family, and yes, love. She doesn't just capture the moments, she transforms the

=== PHOTOGRAPHER: Aamodt Studio | vendor_id=b7b2e7e7-65ca-4d57-9c97-2fd36d94e0d2 | bot=bot3 | date=3/2026 ===
# Aamodt Studio (Estes Park) — vendor_id=b7b2e7e7-65ca-4d57-9c97-2fd36d94e0d2
site=http://www.aamodtstudio.com/ | google 5★ × 9

## site pricing/package lines
Wedding Photography Pricing in Estes Park, CO | AamodtStudio
WEDDING DAY PACKAGES
4 hours &#8211; $2500
6 hours &#8211; $3000
8 hours &#8211; $3500
10 hours &#8211; $4250
Unlimited hours &#8211; $5000
Albums: $700 & up. Details here .
Second Photographer: $550/day
Travel To Front Range: $150
Travel to Vail/Breckenridge: $300
Travel 5+ hrs: $500 + hotel
$750 first hour, $650 ea additional

## google reviews (top 3)
- (5★ 2015-07) We could not have chosen a better photographer to share our special day with and to capture all of the innate details of our wedding experience. Rannveig is a talented artist and the composition of her photos is well thought out so they burst with color and rich texture. She was relaxed during the shoot but was also energetic with ideas and a joyful personality. I don't know how we are going to na
- (5★ 2021-10) Rannveig did the most stunning job of capturing our wedding in Estes Park! She worked so efficiently and helped organize all of us to be our most photogenic selves! The photos are all beautiful and have a natural feel to them; they don't feel forced/posed which is exactly what we were hoping for! We couldn't have found a better photographer and highly recommend her to anyone for any occasion! We a
- (5★ 2019-08) Rannveig was an absolutely amazing photographer for our wedding! She was extremely professional in her ability to organize our bridal party and family. Also, the pictures she took were stunning! Everyone took our breath away. She even stayed later that anticipated to ensure we got all the night shots we wanted. We would highly recommend Aamodt Studio for any wedding photographer. Rannveig was a ma

=== PHOTOGRAPHER: Abbi Pittman Photography | vendor_id=965c25f6-0948-4173-a8de-d2ca42cd0251 | bot=bot4 | date=1/2025 ===
# Abbi Pittman Photography (Durango) — vendor_id=965c25f6-0948-4173-a8de-d2ca42cd0251
site=http://www.abbijpittman.com/ | google 5★ × 12

## site pricing/package lines
Journal Investment Contact
Elopements + Intimate Weddings
Best for slower-paced days with your closest people, 4 hours of coverage | location scouting | digital files with printing rights | online gallery
For full-day coverage where everything matters, minimum 8 hours of coverage | digital files with printing rights | online gallery | second shooter
home journal portfolio investment contact
Abbi Pittman Photo | Durango, Colorado Wedding & Elopement Photographer
Hi, I’m Abbi, a wedding and elopement photographer based in Durango, Colorado.
Browse by Collection

## google reviews (top 3)
- (5★ 2023-06) I recently had the pleasure of having Abbi as my wedding photographer and words cannot express how grateful I am to have had her. From the consultation, to the delivery of the stunning photos, Abbi continuously impressed me. She was an absolute joy to be around, helped me be at ease around the camera, and provided breathtaking photos that were beautifully retouched. If you are having any hesitatio
- (5★ 2025-06) We cannot rave about Abbi enough! She is the sweetest, most talented, and easiest photographer to work with. We hired her for both our engagement and wedding photos. We absolutely loved how our engagement photos turned out and can’t wait to see our wedding pictures — we’re sure they’ll be just as beautiful. Abbi is amazing at making people feel comfortable in front of the camera. She gave us just 
- (5★ 2022-12) Stop looking. This is the photographer you need to hire! Abbi Pittman is an excellent photographer with an incredible eye for detail but also someone you need to have on your team. Abbi was more than just our photographer, she helped pump me up, calm me down, even helped me carry my dress when no one else was around and above all capture me in the way I really wanted to be captured! Not to mention

=== PHOTOGRAPHER: Abie Livesay Photography | vendor_id=edd28499-ae86-47c1-8f77-6d90b967205d | bot=bot5 | date=8/2025 ===
# Abie Livesay Photography (Telluride) — vendor_id=edd28499-ae86-47c1-8f77-6d90b967205d
site=http://www.abielivesay.com/ | google 5★ × 115

## site pricing/package lines
For curated pricing, inquire now.

## google reviews (top 3)
- (5★ 2025-06) Simply put: Abie is an amazing person and her talents go far beyond photography. She has an incredible way of being both everywhere and invisible at the same time, capturing the most intimate, beautiful moments without ever feeling intrusive. But what truly sets her apart is how she carries herself throughout the day. She's calm, thoughtful, and always a step ahead. Abie instinctively knows how to
- (5★ 2025-06) From the moment we met Abie, we knew we were in good hands. Her talent behind the camera is undeniable. The photos she captured are full of heart, movement, and emotion. They tell the story of our wedding in a way that feels both honest and magical. But what really made Abie stand out was the way she supported us throughout the whole weekend. She wasn’t just documenting moments. She was helping cr
- (5★ 2026-01) We are so grateful to have had Abie photograph our wedding day! She did such an amazing job capturing the joy and beauty of the day which allowed us to enjoy every moment. She was great to work with during the planning process and a joy to have around on our day. The photos are absolutely unreal and more than we every could have dreamed of! We would highly recommend working with Abie and her team

=== PHOTOGRAPHER: Above Alpine Photography | vendor_id=8211a8a9-d232-4d7d-9839-8c1c6f3a9d6d | bot=bot6 | date=4/2025 ===
# Above Alpine Photography (Grand Junction) — vendor_id=8211a8a9-d232-4d7d-9839-8c1c6f3a9d6d
site=http://www.abovealpine.com/ | google 4.9★ × 36

## site pricing/package lines
We still offer elopement services but are no longer covering full size weddings.

## google reviews (top 3)
- (5★ 2021-05) Andy with Above Alpine Photography has been with us for our life's most amazing times and captured such wonderful moments. He is so creative, and all of the pictures & videos he's taken for us are absolutely stunning. I'm always so thrilled with the quality and beauty of his work. My favorite thing about working with Andy is that he gets to know his clients and truly captures the emotions and pers
- (5★ 2021-05) Andy Bowen with Above Alpine goes above and beyond any and all expectations. The quality of his work is awe-inspiring - our wedding photos came out more beautiful than I could have ever imagined. He has a unique eye that is able to capture the very best of every subject, and an ability to inspire even the most camera-shy among us. He’s very professional and is able to turnaround his projects in a 
- (5★ 2021-05) I have had the pleasure to work with Above Alpine Photography for years. I would never use anyone else. Andy has such a beautiful, creative eye and captures the most genuine, beautiful images! He is so easy to work with and always delivers an incredible product. His level of care is undeniable and his passion is obvious. If you’re looking for photos, video or music and you want amazing content, co

=== PHOTOGRAPHER: Addie Knott Photography | vendor_id=2fff4859-e340-4fa1-84c0-4f26d5364a0a | bot=bot7 | date=3/2025 ===
# Addie Knott Photography (Severance) — vendor_id=2fff4859-e340-4fa1-84c0-4f26d5364a0a
site=http://www.addieknottphoto.com/ | google 5★ × 98

## site pricing/package lines
Investment &mdash; Colorado Photographer
Wedding packages starting at $3,000
Finding the love of your life should be the hard part - not finding your wedding photographer! I’ll capture your true love with natural light and raw emotion. Fully enjoy your wedding day knowing you can look back on this moment forever. Clients typically invest between $3,000 and $4,000.
An engagement session, a styling guide, 1-2 photographers, all edited images and an online gallery with a print release!
Ask me about packages!
Starting out at $3,000
Note: All packages include the option for custom payment plans! *Want to create a custom package? *
Sessions + engagement packages $550
We dream of our engagement our entire lives - remember this time forever with an engagement session that sets the vibe for your new life together. Look back on wedding anniversaries to a collection of timeless photos documenting your emotions from that special moment it all started.
All sessions other than weddings starting out at $550
Note: All packages include payment plans! Want to create a custom package?
YES. I know money doesn’t grow on trees, and I know covid hit a lot of families really hard. we can create a totally custom payment plan that fits your needs best. I truly don’t believe people should sacrifice quality for price, so that’s where the payment plans come in handy.
What’s all included in a wedding package?
Ready to make the investment for your forever memories?
It’s more than just finding the right aesthetic and pricing…

## google reviews (top 3)
- (5★ 2025-12) Addie is the absolute BEST!!!! Not only is she an amazing photographer, she is genuinely an incredible person! From our first conversation to the wedding day we knew we were in the best hands possible. Her talent, warm and bubbly personality, organization, caring nature and professionalism made her the perfect person to capture our story! On the day of the wedding, she was calm and somehow everywh
- (5★ 2022-09) Addie was a last minute booked photographer because mine ended up being sick & couldn’t shoot. This was a destination wedding for us so I was nervous not knowing her at all. She was absolutely amazing. Addie went above & beyond our expectations! Very friendly & very easy to work with. She will make sure all your needs are met & naturally makes everything run smoothly. What started as a very stress
- (5★ 2025-07) Addie photographed our wedding. Not only were the final photos beyond anything I could’ve asked for, but she personally made our night so much fun. She’s professional, timely, quick to act in the moment and fantastic at directing guests and bridal parties to capture every moment. We had so much fun shooting with Addie and her photos turned out unbelievable. She is talented, experienced and hilario

=== PHOTOGRAPHER: Adventure Amore | vendor_id=5a82085c-509e-4eaf-ad2b-a4dab4b73312 | bot=bot8 | date=4/2026 ===
# Adventure Amore (Denver) — vendor_id=5a82085c-509e-4eaf-ad2b-a4dab4b73312
site=http://adventureamore.com/ | google 5★ × 62

## site pricing/package lines
Elopement Packages Crested Butte 🥇 Elopement Photographer
Packages And Pricing
Eloping in Crested Butte: Elopement Packages Capturing Every Moment
As your dedicated elopement photographer, I&#8217;ll be there to capture every meaningful instance throughout your day. Our specialized packages for eloping in Crested Butte are ideal for partners looking to craft their personal tale.
Elopement Packages Crested Butte: Extraordinary Experiences
Your Best Option for Stunning Crested Butte Elopement Photography
Adventure Amore tailors elopement packages in Crested Butte for couples who are seeking to celebrate their distinctiveness in a one-of-a-kind way. I am dedicated to photography and capture the authentic and stunning moments between lovers leading up to their union together.
We’ll be by your side to snap picture-perfect, energetic images of you and your spouse in the most beautiful Crested Butte elopement venues.
Meet Your Adventure Elopement Photographers In Crested Butte
Who Opts for Elopement Packages in Crested Butte?
An adventure elopement in Crested Butte offers more than simply exchanging vows, sealing it with a kiss, and toasting to the happy couple with a glass of champagne. Crested Butte elopements go beyond the usual wedding format, adding a personal and unforgettable touch.
With Adventure Amore, couples embracing a Crested Butte elopement experience an expression of their individuality. A day tailored to their desires and lasting moments that aren&#8217;t designed by anyone but themselves &#8211; it&#8217;s all about you and who you are as a union.

## google reviews (top 3)
- (5★ 2024-06) Book him. Book him right now, or you're definitely going to regret it!! Here's my proof - My husband and I are from Pennsylvania. We eloped on June 12, 2024, in Breckenridge, Colorado, with Adam as our Elopement Photographer. We did not want to have a traditional big wedding with all the family members and vendors because that's not our style. We wanted an adventurous, sightseeing, no-judgment mou
- (5★ 2024-09) Going into the process of planning our elopement, I was overwhelmed with just about everything — from everything that needed to get done, finding the perfect location in a state I’ve never lived in, what we even wanted to do, and getting all of that figured out in a timely manner. Adam made all of that a breeze! He did all of the organizing for me with an amazing timeline that broke everything dow
- (5★ 2025-03) Working with Adam was the best choice we made when it came to our wedding planning! We were really overwhelmed by the planning process, and he walked us through every step and made the whole experience fun and personalized. We brought a group of family and friends with us from Ohio to Colorado for our wedding in Breckenridge, and Adam found us the perfect place, helped coordinate every detail, and

=== PHOTOGRAPHER: Aelpha Collective | Photography and Video | vendor_id=99032305-347d-4673-a64c-7f04731738a1 | bot=bot9 | date=1/2026 ===
# Aelpha Collective | Photography and Video (Durango) — vendor_id=99032305-347d-4673-a64c-7f04731738a1
site=https://www.aelphacollective.com/ | google 5★ × 40

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2024-01) When we decided to elope, we knew we really only needed one thing and that was an amazing photographer. Hans and Desiree were so much more than we ever dreamed. Not only were they super communicative and professional but the photos they captured were so much more than we could have asked. They were also so flexible with our elopement date because of a snow storm that blew in and were so amazing re
- (5★ 2022-08) If I could give ten starts I would!!! My husband and I just recently eloped near Silverton in the San Juan Mountains. Hans was absolutely phenomenal, from his energy, personality to his flexibility! He was willing to do anything to get the perfect shot and my gosh, did he ever! He was willing to hop on one of our ATV’s to another location right up the pass to capture some more amazing pictures! I 
- (5★ 2025-12) Hans was the most professional, fun, communicative, patient, and talented photographer I have ever worked with. His was very accommodating and flexible as he wrangled 13 people into position for pictures. He learned everyone’s name in about 3 minutes and was able to make this a fun event. H the pictures turned out great- I HIGHLY RECOMMEND Aelph Collective!!

=== PHOTOGRAPHER: Aesthetic Collective | vendor_id=27e85de8-bdb7-4c48-a464-c98aee9eed15 | bot=bot10 | date=5/2026 ===
# Aesthetic Collective (Grand Junction) — vendor_id=27e85de8-bdb7-4c48-a464-c98aee9eed15
site=http://www.aestheticcollectivegj.com/ | google 4.7★ × 41

## site pricing/package lines
All Aesthetic Collective policies, procedures, and pricing are subject to change without notice.
Updated pricing effective 1.1.26

## google reviews (top 3)
- (5★ 2025-11) We hosted our wedding reception at Aesthetic Collective, and it was everything we dreamed of and more. The space itself is stunning!!! The exposed brick walls and tall windows create such a warm, inviting glow, especially as the sun sets. The versatility of the studio allowed us to transform it into an intimate, elegant celebration with 65 guests, a full band, DJ, mobile bar and catering, with ple
- (5★ 2026-01) We hosted our annual client appreciation event at Aesthetic Collective, and it was absolutely perfect. The space is stunning—clean, modern, and beautifully designed—making it an ideal backdrop for both professional photography and hosting an elevated event. The layout allowed for great flow with our guests, and the natural light was incredible for photos. Our clients were genuinely impressed by th
- (5★ 2023-07) I had my bridal shower here a few months ago and it was an AMAZING experience!! Kaylee was amazing to work with and made the whole experience stress free! It turned out absolutely beautiful and I got so many compliments about how beautiful the space was!! When I showed up, everything was set up and arranged and take down was easy too! I 100% will be hosting future events there and definitely recom

=== PHOTOGRAPHER: Aether Photo & Films | vendor_id=dc8073e7-aa4e-41db-889f-dad7019f35ba | bot=bot11 | date=5/2026 ===
# Aether Photo & Films (Telluride) — vendor_id=dc8073e7-aa4e-41db-889f-dad7019f35ba
site=https://aetherphotography.com/ | google 5★ × 29

## site pricing/package lines
Please use the form below to get our current pricing and availability. Or just say hi.
Meg &#038; Eddie&#8217;s Ouray Adventure Elopement
Jessica and Thomas&#8217;s Colorado Adventure Elopement
Lindsay and Cooper&#8217;s Colorado Adventure Elopement
Amanda &#038; Chris&#8217;s Bridal Veil Falls Elopement in Telluride, Colorado
Ryan &#038; John&#8217;s Adventure Elopement in Ouray
Investment - Aether Photo + Films
WEDDING PHOTOGRAPHY AND VIDEOGRAPHY COLLECTIONS
REQUEST OUR PRICING GUIDE
Telluride Weddings & Elopements
Amanda &#038; Chris’s Bridal Veil Falls Elopement in Telluride, Colorado: VIDEO

## google reviews (top 3)
- (5★ 2020-01) Ben is an outstanding photographer! When researching a photographer for our Telluride wedding at Gorrono Ranch, it really wasn't a contest. Ben had everything we wanted from the charming candids to the non-cheesy group shots all the way to the glowing sunset photos. Our parents and a few of the guests noted on his professionalism and how he was so sly in that you never even realized he was there. 
- (5★ 2020-01) Ben Eng is a photography ninja. He was super experienced and professional and knew the area extremely well. He directed us to some areas that he knew would be good and the photos turned out looking unreal. We would recommend Ben for anyone getting married in Telluride. I love looking through the pictures and reliving that incredible day.
- (5★ 2019-11) Ben was absolutely brilliant from start to finish. Professional, efficient, friendly and, most importantly, took the most fabulous photographs of our wedding. We are so happy to have the memories that he captured. We could not have wished for a better photographer. Thank you Ben!

=== PHOTOGRAPHER: Alexi Hubbell Photography | vendor_id=17d0fca7-b2b9-4509-93ff-4030c727aa4c | bot=bot12 | date=3/2026 ===
# Alexi Hubbell Photography (Durango) — vendor_id=17d0fca7-b2b9-4509-93ff-4030c727aa4c
site=http://www.alexihubbellphotography.com/ | google 4.9★ × 54

## site pricing/package lines
Durango Colorado Wedding and Elopement Photographers - Alexi Hubbell Photography
Elopement/Intimate Wedding Pricing & FAQs
Portrait Pricing + FAQs
Info / Elopement/Intimate Wedding Pricing & FAQs
Durango Colorado Wedding and Elopement Photographer
Wedding and Adventure Elopement Photography in Durango, Colorado and Beyond!
Destination Adventure Elopement in the San Juans: Amanda & Bransen
All of Alexi Hubbell Photography's wedding packages include our luxury wedding albums.
Read more about our wedding albums here.
Adventurous Engagement Sessions
Contact us about your wedding or elopement today and let's get to making some magic!
Alexsa and Kam's Ridgway Elopement
Wedding & Elopement Pricing
Current Elopement Client Questionnaire
Durango, Colorado Wedding, Elopement, Portrait, Headshot, Boudoir, and Commercial Photographer
Info and Pricing for Durango Wedding Photographers
Elopement/Intimate Photography Pricing and Information
Durango Colorado Wedding Photography Pricing and Info
Elopement & Wedding Photography FAQs
What is your elopement and intimate wedding pricing?
Elopement and intimate wedding collections start at $1800 and can be found by clicking on the pricing button below. Please contact Alexi to discuss your specific circumstances and needs.
Elopement & Initmate Wedding Pricing
Do you shoot weddings with a second photographer?
We offer second shooter fees as add-ons to wedding packages. We can help guide you to the right decision on the number of photographers needed.
Is there a travel fee if my elopement or session is outside of Durango, CO?
pdf rate cards seen on site (not fetched): https://www.alexihubbellphotography.com/s/ElopementPricing2026.pdf ; https://www.alexihubbellphotography.com/s/Elopement-Pricing-2024.pdf

## google reviews (top 3)
- (5★ 2022-09) Alexi was AMAZING! Like I can’t even rave enough about all the ways she was so perfect, but I’ll try and hit the most important ones.. 1. Communication was top notch. I’m from Florida, and planning a destination wedding in Colorado wasn’t the easiest. But Alexi was on top of everything. When we first inquired, we set up a phone call where she explained EVERYTHING to me. After booking, we had great
- (5★ 2021-09) I was getting highly discouraged while shopping for a local wedding photographer. Prices seemed way too high for the quality of the photos that others were asking. I knew Alexi was a talented photographer and reached out for advise on a great wedding photographer, I was beyond thrilled when she said she was a wedding photographer. We set up a consultation and started to look at previous weddings s
- (5★ 2024-06) I can’t say enough about our experience with Alexi. When my now husband and I decided we wanted to elope, my only request was a beautiful Mountain view for our pictures. We were on a time crunch because I am a school teacher and didn’t want to ask for days off once school started. My husband began the search and stumbled upon Alexi hubbell photography and her elopement packages. From the very firs

=== PHOTOGRAPHER: Alive Studios Photography | vendor_id=1ee22de7-d958-4920-b533-d3b67b26123d | bot=bot13 | date=3/2025 ===
# Alive Studios Photography (Boulder) — vendor_id=1ee22de7-d958-4920-b533-d3b67b26123d
site=http://www.alivestudios.com/ | google 5★ × 13

## site pricing/package lines
Investment - Alive Studios

## google reviews (top 3)
- (5★ 2022-12) I highly recommend Benjamin to photograph your next event. He recently photographed my wedding in September 2022 at Boettcher Mansion. Everyone who sees my photos says “Wow, you had a fairytale wedding.” And I have to thank Benjamin for being an artist with the camera. He captured all the most beautiful moments, in just the perfect lighting, and had ideas I never would have thought of, but which m
- (5★ 2023-07) We worked with Alive Studios as our wedding photographer. And our wedding photos came out SO good. We are so happy to have these photos to treasure for the rest of our lives. From the planning phase to the day of to the editing phase, Benjamin was a joy to work with. He is both professional and relaxed and kept the whole process fun and stress-free. Highly recommended!
- (5★ 2025-08) Look no further for your event photography needs. Benjamin went above and beyond to truly capture our organization's annual convention, and crushed every level of expectations I had. Not only did he demonstrate attention to detail and care for our vision, but found opportunities to enhance our plans and was extremely easy to work with. I'm looking forward to more opportunities to work with Benjami

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-02.csv
