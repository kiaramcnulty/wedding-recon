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


=== PHOTOGRAPHER: Toni Axelrod Studios | vendor_id=19a1358e-7c7a-4096-bbf9-995bf2092824 | bot=bot9 | date=1/2025 ===
# Toni Axelrod Studios (Vail) — vendor_id=19a1358e-7c7a-4096-bbf9-995bf2092824
site=http://www.axelphoto.com/ | google 5★ × 33

## site pricing/package lines
We deeply appreciate your easy-doing, down-to-earth, friendly, and flexible demeanor as well as a willingness to handle our small wedding elopement. You masterfully captured the day so we can relive it regularly. ”
“ Your pictures are stunning! Just as I knew they would be, and you were the best investment of my wedding. If you ever need a referral, you can count on me to give you a glowing review. ”

## google reviews (top 3)
- (5★ 2025-02) Toni Axelrod Studios is absolutely incredible! Toni captured both our engagement and wedding beautifully, and we couldn't be happier with the results. She has an amazing eye for photography, and it truly shows in every shot. Not only is her work stunning, but she is also so easy to work with professional, personable, and genuinely passionate about what she does. She made both experiences seamless 
- (5★ 2025-02) If I could give Toni 10 stars, I would. She took our engagement photos one year ago, and so when we knew that we were going to head back to Vail for our wedding, we just had to work with her again. She was so fun to be around, accommodated our last-minute schedule, and the pictures turned out absolutely stunning.
- (5★ 2022-01) I highly recommend Toni Axelrod. Toni is extremely professional, great to work with, and takes incredible photos. I surprised my now fiancé with a proposal in Vail, and Toni helped me pick the perfect spot and captured the moment beautifully. I emailed Toni two weeks before my planned proposal, and she was quick to respond with a call. Toni had amazing ideas to help me decide on how I wanted to pr

=== PHOTOGRAPHER: Trystan Photography | vendor_id=8713ed00-1aa4-4854-988d-9386790917c0 | bot=bot10 | date=7/2025 ===
# Trystan Photography (Colorado Springs) — vendor_id=8713ed00-1aa4-4854-988d-9386790917c0
site=https://www.trystanphotography.com/ | google 4.7★ × 23

## site pricing/package lines
Pricing for Portraits | Trystan Photography
Our Portrait Pricing
Up to 6 portrait subjects. $15 per extra subject.
Contact us for our detailed portrait pricing...
No, the digital image files that come with your portrait package are non-watermarked and full resolution. They are the same final digital negatives we use.
We require a 1/2 deposit with your signed contract to book your date. The remaining 1/2 is due on the day of the portrait session. All installments are non-refundable in event of your cancellation.
Pricing for Weddings | Trystan Photography
Starts at 5 hours coverage (inquire about smaller customized packages)
$400 print credit (*can't be used towards albums)
Contact us for our detailed wedding pricing...
Parent copies start at $500
Charlotte will always be your lead photographer/videographer. She works with a handful of talented credible photographers, having one of them as a second shooter for every wedding package that includes two photographers.
No, the digital image files that come with your photography package (for both the engagement and the wedding) are non-watermarked and full resolution. They are the same final digital negatives we use.
We require a 1/3 deposit with your signed contract to book your date. Another 1/3 is due at the halfway point, and the final 1/3 is due on the day of the wedding. All installments are non-refundable in event of your cancellation.
Do you offer smaller packages?
Weddings come in all styles and sizes. Our main wedding packages start at 5 hours and include two photographers. However, we do work with smaller weddings and can customize a package for you with less than 5 hours and one photographer! Please inquire for more details.

## google reviews (top 3)
- (5★ 2014-12) Trystan Photography was an excellent choice for our destination wedding in Breckenridge, Colorado! Not only were both Trig and Char so friendly and fun, but they new exactly what they were doing! I was relieved that they took charge and guided us around Breckenridge for the perfect shots, since we were from out of state and clueless as to where to go other than "on top of the mountain" and "on Mai
- (5★ 2021-08) Our daughter wanted her Senior pictures done at Garden of the Gods. Though we moved to Utah several years ago, Colorado is "home" for her. We knew of Trystan Photography's work and knew they were who we wanted to go with. Charlotte does the MOST amazing work I have ever seen! Choosing which pics we want is nearly impossible because they are all so good. (yes, we DID end up buying them all!) It was
- (5★ 2023-08) We used Trystan Photography for our wedding last weekend, and I even though I haven't seen the photos yet, I want to give Char and Jamie 5 stars - they were so nice to work with; professional and skilled while also being happy, genuine, and fun. Char directed photos very efficiently and made sure everyone felt comfortable and everything went extremely smoothly. I can't wait to see the photos, but

=== PHOTOGRAPHER: Two Elk Studios | vendor_id=fe441f96-1683-4945-b734-a5f59c57a173 | bot=bot11 | date=6/2025 ===
# Two Elk Studios (Edwards) — vendor_id=fe441f96-1683-4945-b734-a5f59c57a173
site=http://www.twoelkstudios.com/ | google 5★ × 21

## site pricing/package lines
Wedding, Engagement, & Elopement Photography | Vail Colorado | Two Elk Studios
WEDDING, COUPLE, AND ELOPEMENT PHOTOGRAPHY
WEDDINGS AND ELOPEMENTS
Looking for an intimate alternative to a traditional wedding? We absolutely love Mountain Elopement Photography. All the love and joy, with the added benefit of flexible scheduling and any location you can imagine!
However, your wedding album will last multiple lifetimes and be something you can pass on for generations.
Two Elk Studios Wedding Collections start at 12,000 for weekday coverage. Includes: photography by Jesse and an associate and the initial pages of a beautiful custom Heirloom album of your day.
Ali & Ryan | Loveland Pass Mountain Elopement

## google reviews (top 3)
- (5★ 2020-09) We hired Two Elk Studios to photograph our Welcome Party the night before our wedding, and we also hired them for the day of our wedding for a fun interactive photo wall! Jesse was the photographer for our Welcome Party, and he did a beautiful job. The photos are great! Jesse was also the attendant of our interactive photo wall at our wedding the following day, which was a huge hit with all of our
- (5★ 2019-06) Working with Jesse has been an incredible experience. He is extremely easy to work with and you can tell he loves what he does. It was wonderful getting to meet him prior to our wedding to do the engagement photo shoot so that when it came time for wedding day, we could look natural as he did his work. He has a great blend of artistic vision and making sure to capture the energy of the event. I hi
- (5★ 2022-01) I've had the pleasure of working with Jesse on a few different occasions. The first occasion was a family photo session with my wife, 2 year old son, and 2 big dogs. Jesse was amazing at getting our kiddo to smile and laugh while helping us get the dogs just right too. In all of this he was calm, light hearted and captured amazing photos. Some perfectly proper and some fun candid shots as well! Th

=== PHOTOGRAPHER: Type Deux Weddings | vendor_id=d9583e7e-425a-43f6-859b-600829c953f2 | bot=bot12 | date=10/2025 ===
# Type Deux Weddings (Colorado Springs) — vendor_id=d9583e7e-425a-43f6-859b-600829c953f2
site=http://www.typedeuxweddings.com/ | google 5★ × 10

## site pricing/package lines
Engagement Sessions,
Engagement sessions starting at 350
Engagement Sessions & Save-The-Date Films
Wedding & Elopement Photography
Wedding & Elopement Films
All wedding packages are eligible for payment plans up to 18 months
Full day film coverage allows the wedding to be told as a complete story. From arrival through the final sendoff, this option creates space for natural moments, cinematic pacing, drone footage, and a film that reflects not just what happened, but how the day felt.
Designed for shorter wedding days or elopements, half day film coverage focuses on the ceremony and reception where the emotional core of the day lives. This option captures the most meaningful moments with a cinematic, story-driven approach.
Full day coverage allows the story to unfold naturally from start to finish. Coverage begins when you arrive and continues through your sendoff, creating space for quiet moments, thoughtful portraits, drone footage, and a more complete, cinematic story of your day.
Ideal for shorter wedding days or elopements, half day coverage focuses on the heart of your celebration. From the ceremony through the reception, the emphasis stays on capturing the moments that matter most with intention and care.
Half day photo and film coverage focuses on the most meaningful parts of your wedding day, combining still images and cinematic storytelling to preserve the ceremony and reception. This option offers a complete visual record of the moments that matter most, told through both photographs and film.

## google reviews (top 3)
- (5★ 2020-12) Tyler is by far the most creative photographer in the game! If you want one of a kind images that blow your mind, Tyler is the photographer for you. No matter if it’s wedding or couple photos, action shots, landscape, or anything in between, he has an incredible eye for lighting, creative angles and one of a kind images. His editing process will leave you in awe and leave you with the most beautif
- (5★ 2020-12) Tyler is a one of a kind photographer. His passion and creativity is unmatched. We loved our engagement shoot so much that we flew him out to Hawaii to shoot our wedding! And of course we were not disappointed. I have shot with many photographers and he is by far my favorite. If I could give more stars I would! Thank you Tyler!
- (5★ 2020-12) Tyler came to Montana and took engagement pictures of my fiance and I. He is very professional, and you can see the passion that he has for taking pictures. My fiance and I are older, yet he was able to capture a much younger, playful side to both of us. He also took pictures of my fiance's 13-year-old son. I have to say they're the best pictures I've ever seen of Moses. He captured the horses on

=== PHOTOGRAPHER: V’s Photography | vendor_id=fb3310bd-e2ec-49cc-b0cb-c04c8eddaba9 | bot=bot13 | date=8/2025 ===
# V’s Photography (Grand Junction) — vendor_id=fb3310bd-e2ec-49cc-b0cb-c04c8eddaba9
site=https://www.vsphotography.gallery/ | google 5★ × 24

## site pricing/package lines
INVEST IN YOUR MEMORIES
Capture every beautiful moment of your special day. Ideal for wedding and elopements or corporate events, parties, or special occasions, Please contact directly for a customized package to fit your needs. Following is starting rate per hour for video and Photo coverage.
View Package Options
The amount of images is depending on the package that you choose to go with.
http://www.vsphotography.gallery/investment2
Whether it's a wedding/elopement, event or just capturing two humans in love or a family of even just yourself - I have done it all. My visual style is fly on the wall documentary style, full of life and emotions and all the little moments you didn't think anyone was paying attention too.
Every shoot is unique and different. However, I have put together a pricing page that would give you an idea on how much to budget for the photoshoot of Your Needs.
Second Shooter at V's Photography & Media

## google reviews (top 3)
- (5★ 2025-06) V is a phenomenal photographer who genuinely cares about both her clients and the final product. I told her upfront that I’m more comfortable behind the camera than in front of it. I went into our session just hoping I’d like a few of the shots because I’m usually pretty critical of myself. But when I got the gallery back, I was shocked by how many photos I actually loved. The ones I didn’t favor 
- (5★ 2025-11) Veronica is wonderful. She stays calm and collected even during stress. She made our wedding day so much more peaceful and completely took control of all the photography details so we could be present in the moment. She also made us an incredible video that we will treasure FOREVER. Can't recommend her enough!!!!
- (5★ 2023-10) I recently hired Veronica to photograph our grand opening event at Monument Vista Place. I met with Veronica a few weeks before the event and we walked through the property and discussed my goals. She was very professional. On the day of the event she arrived early and was supported by a second photographer, Iliana, to help cover every angle. We had a huge turnout of over 200 people and Veronica a

=== PHOTOGRAPHER: Valley to Summit Photography | vendor_id=f244834e-2ddf-4fd4-8700-ff81e6ae7c88 | bot=bot14 | date=5/2026 ===
# Valley to Summit Photography (Avon) — vendor_id=f244834e-2ddf-4fd4-8700-ff81e6ae7c88
site=http://www.valleytosummitphoto.com/ | google 5★ × 8

## site pricing/package lines
elopements family sessions about
Pricing begins at $3,800
All collections include
Colorado Wedding Pricing
Colorado Family Photographer Colorado Wedding Photographer Colorado Elopement Photographer
Colorado Wedding, Elopement, and Family Photographer
colorado elopement, wedding, and family photography in the mountains of Breckenridge + Vail + beyond
COLORADO MOUNTAIN Wedding, elopement, and family photographer FOR THOSE WHO LOVE THE OUTDOORS
I specialize in Colorado mountain elopements, weddings, and portrait sessions in Breckenridge, Vail, and Beaver Creek for those who want more than just the typical posed shots. If you're into laid-back energy, mountain views, and laughing your way through the day, I'm the photographer for you.
elopement info For couples saying "I do!" in the
Elopements & Micro-Weddings
If you decide I am the photographer for you, the signing of a contract and a retainer fee will have you officially booked with Valley to Summit Photography!
Head on over to the contact form to tell me more about your photography needs. I will respond within two business days with more information on packages, availability, and details.
Photography type (elopement, family, etc.)
Colorado mountain elopement, wedding, and family photographer
Valley to Summit Photography provides Colorado mountain elopement, wedding, and family photography to couples and families adventuring through Breckenridge, Vail, Beaver Creek and beyond.
Colorado Elopement Photographer
colorado elopement & Micro-wedding photographer

## google reviews (top 3)
- (5★ 2022-04) I would need ten pages to describe how wonderful our experience was with Valley to Summit Family Photography. We felt so at home immediately! We are from over ten hours away and we were out of our element, but our photographer, Alex, made us feel so comfortable that we knew this was going to be an incredible experience. She took any picture that we suggested and she allowed us to be creative. She 
- (5★ 2022-11) We absolutely LOVE the photos that Alex took of our family in Vail. Alex was a JOY to work with! She was very professional and responsive via email and phone when we set up the appointment and was wonderful with my two girls (which made for happy pictures!) Alex went above and beyond my expectations - when the weather report looked crummy, she worked with me to reschedule and move up the date a fe
- (5★ 2023-07) From start to finish, Alex was so great to work with! The photo session was relaxed, fun, and such a special experience for our family. The process of receiving proofs and edited photos was simple and efficient. Alex chose stunning backdrops for our photos and we will cherish them always. Alex beautifully captured a special time for our family and we would highly recommend her! ⭐️ ⭐️⭐️⭐️⭐️

=== PHOTOGRAPHER: Veils of Vail Wedding Planning & Design | vendor_id=a2752144-7715-4794-a7d4-a417e41fa3cd | bot=bot15 | date=6/2026 ===
# Veils of Vail Wedding Planning & Design (Eagle) — vendor_id=a2752144-7715-4794-a7d4-a417e41fa3cd
site=http://www.veilsofvail.com/ | google 5★ × 41

## site pricing/package lines
All Packages &mdash; Veils of Vail
Full Service Planning Package
Partial Service Planning Package
Wedding Management Package
Wedding Weekend Coordination Package
Full Service Planning Package &mdash; Veils of Vail
Partial Service Planning Package &mdash; Veils of Vail
Wedding Management Package &mdash; Veils of Vail
If you are interested in learning more about our wedding planning and coordination services, please connect with us to set up a complimentary discovery call. From there we will put together a detailed proposal of our services and pricing based on your wedding planning needs and guest count.

## google reviews (top 3)
- (5★ 2025-07) Words cannot fully capture how incredible Becca is—not just as a wedding planner, but as an exceptional human being. From the moment we began planning our wedding with Vail Resorts 1.5 years out, Becca went above and beyond to make our day truly unforgettable. When I interviewed other planners, I never felt a genuine connection. But with Becca, it was immediately clear that she puts her heart and 
- (5★ 2025-06) The BEST decision we made for our wedding! We truly cannot say enough good things about Becca Gould and Veils of Vail. From start to finish, Becca was absolutely instrumental in planning and executing our dream wedding. Every detail came together flawlessly thanks to her incredible organization, expertise, and calm presence. She has an amazing eye for detail, knows all the best local vendors, and 
- (5★ 2025-06) Highly recommend Veils of Vail wedding Planning & Design for your wedding planning needs. Becca, who runs the show, is phenomenal. The is so friendly, personable, and Incredibly knowledgeable! My wife and I would have been so lost without a great planner like Becca. She kept us on track all the way throughout. Monthly meetings, great shared note taking that Becca kept organized and updated promptl

=== PHOTOGRAPHER: Venue on the Rocks | vendor_id=07813e85-a1bf-49a9-b70f-8b8768e9dbcc | bot=bot16 | date=6/2026 ===
# Venue on the Rocks (Estes Park) — vendor_id=07813e85-a1bf-49a9-b70f-8b8768e9dbcc
site=https://venueontherocks.us/ | google 4.8★ × 11

## site pricing/package lines
Wedding Planning Packages Designed Around You
Full day coverage from set up to tear down
Find the Package to Start Your Forever
Packages Made for Every Love Story
Are you dreaming of a quiet morning, “I do?” Or a full day, lively celebration? Whatever you’re looking for, from micro weddings to big parties, you’ll find an option that fits your day, your rhythm, and your forever.
$550 per additional hour
Your all-in-one celebration. With access to both ceremony and reception spaces, this package is ideal for couples who want the classic, full-day wedding with vows by the river, photos with the mountains, dinner, dancing, and all the moments in between.
Perfect for guest lists of up to 30, this intimate package gives you all the magic of a full celebration on a smaller, sweeter scale.
For couples who want to relax into their day, knowing every detail is handled. Our most exclusive package includes premium features, extended venue access, and thoughtful touches that make your wedding feel seamless, elevated, and effortless from the moment you arrive to your final send off.
Beautiful, memorable celebrations shouldn’t come with limitations. Our flexible packages make it simple to plan an unforgettable event that fits your vision and your budget.
pdf rate cards seen on site (not fetched): https://venueontherocks.us/s/VOTR-2026_2027-Pricing.pdf ; https://venueontherocks.us/s/Venue-on-the-Rocks-Planning-Packages-2026.pdf

## google reviews (top 3)
- (5★ 2023-11) Venue on the rocks is and will be the biggest upcoming venue for elopements/weddings. My husband and I toured many venues looking for the perfect place to have our reception, we were on our last ditch effort when we stumbled upon Venue on the rocks and FELL IN LOVE with the venue. Us and our guests had such a positive experience with Rachel, Lydia, Kinsey and the whole staff. Planning was fairly e
- (5★ 2025-10) We’ve loved Coffee on the Rocks as a coffee shop for years, so we were thrilled to host our wedding celebration there — and it completely exceeded expectations. The space is beautifully designed — simple yet magical — and the setting, especially in the fall, is absolutely stunning. The entire team was so helpful throughout the planning and booking process, and a special shoutout to Lydia, who went
- (5★ 2025-09) We said "I do" at Wedding on the Rocks and it was everything I ever dreamed it would be! I absolutely adored Lydia, our day-of coordinator. She was wonderful with communication, taking the time to hop on the phone with me several times to help me organize everything (we live in Ohio and planned from afar). On the wedding day itself, she was so kind, calm, and sweet, making the whole experience fee

=== PHOTOGRAPHER: Vows and Peaks | vendor_id=ddad483e-44cc-46c1-a7ab-0d8e024ead5b | bot=bot17 | date=2/2025 ===
# Vows and Peaks (Denver) — vendor_id=ddad483e-44cc-46c1-a7ab-0d8e024ead5b
site=https://vowsandpeaks.com/?utm_source=google&utm_medium=organic&utm_campaign=gmb_profile | google 5★ × 138

## site pricing/package lines
Colorado Elopement Packages & Pricing for 2026 | Vows and Peaks
Elopement Packages &#038; Pricing
Elopement Resources Expand
Telluride Elopement Guide
Breckenridge Elopement Guide
San Juan Mountains Elopement Guide
Sound like your kind of thing? Skip to my packages !
What&#8217;s included in a Colorado elopement package with Vows and Peaks?
Here&#8217;s some extra details of each package:
I&#8217;ve built these packages around a tight-knit team of elopement vendors who specialize in mountain elopements. These are my 3am people. When the headlamps go on and the magic starts!
Custom elopement planning app:
Your fully edited, high-resolution gallery lands in your inbox within 8-10 weeks. Unlimited downloads, a shareable link, and images shot to print large. If you want something physical, handcrafted fine-art albums are available or you can print straight from your gallery anytime.
Vows and Peaks Colorado elopement packages & pricing
Vows and Peaks elopement packages range from $4,700 for a 4-hours up to $12,000 for a fully all-inclusive package with video, hair, makeup, and florals. The main difference between each pack is time, and more time means more locations, more breathing room, and more of the day.
The most-booked option is the Wilderness package at $6,000 for 8 hours. It gives couples enough room to hike, do a first look, hold a ceremony, share a first dance, and still have space for the day to breathe.
Tree Line Elopement Package
The 4-hour window is genuinely enough time to get to a great spot, have a real ceremony, and walk away with images that look nothing like a quick session. It&#8217;s not a budget version of the full day. It&#8217;s just a different kind of day.

## google reviews (top 3)
- (5★ 2024-11) Words can't begin to express how amazing Sean is and how happy we are with our experience. My husband and I had a small intimate wedding with 15 of our closest friends and family. We found Sean early on in our wedding planning and knew we wanted to work with him right away. At our first meeting, we envisioned our perfect day from start to end which included a private vow ceremony, epic views, and 
- (5★ 2025-10) From start to finish, our experience working with Sean at Vows & Peaks was so well-coordinated and fun. We found him through a Google search and, out of the many results, his website and offerings spoke to us as the most authentic and genuine. He was incredibly quick to respond when we reached out for more information and took the time to get to know us and what we wanted from our elopement. He co
- (5★ 2026-01) Working with Sean was an absolute dream! We came across Vows and Peaks when we first got engaged and knew he was the perfect fit right away. Sean is so dedicated to his work and it was evident that he has a passion for elopement photography. His communication with us leading up to it was incredible and he was always available to answer all of our questions. The few days leading up to our big day t

=== PHOTOGRAPHER: Walnut Street Photography | vendor_id=821f8d11-3eff-4f3c-9c6a-8af5ab33a461 | bot=bot1 | date=11/2025 ===
# Walnut Street Photography (Boulder) — vendor_id=821f8d11-3eff-4f3c-9c6a-8af5ab33a461
site=http://www.walnutstreetphotography.com/ | google 5★ × 80

## site pricing/package lines
Up to 2 Hours of Coverage
75+ Final Edited Images for the first hour, 50 Final Edited Images per hour after
No Travel Fees within 2 Hrs of Denver
For the past several years I’ve mostly been photographing small weddings and elopements, about 150-200 per year, but still love a good large wedding as well! I also still do family sessions for all the families we’ve met over the past 11 years.

## google reviews (top 3)
- (5★ 2023-11) Noah was referred to us by our wedding coordinator, Iver with Colorado Micro-Weddings. When I tell you we were blown away with the portraits he took of us to us we meant it. Noah went above and beyond on the day of our wedding. He drove us up the mountain for our portraits, assisted my family in putting on boutonnieres, and even placed my veil in my hair. Any minor detail Noah was there to help. N
- (5★ 2024-09) We booked Walnut Street Photography while planning our wedding with Colorado Micro-Weddings. Noah was absolutely amazing to work with! My husband and I are SO happy with how our photos turned out. Noah was wonderful and made things so easy for us on our wedding day. We are not from the area, so he arranged to bring our wedding flowers from the florist to us before our ceremony. He was so attentive
- (5★ 2023-08) Noah was absolutely amazing to work with. My husband and I had a micro wedding in Boulder this past June, and Noah captured our day beautifully. After the ceremony at Sunrise Amphitheater, we went up to Lost Gulch and he made our couples shots feel completely natural. We completely and strongly recommend Walnut Street Photography! Absolutely beautiful work and so much fun to work with.

=== PHOTOGRAPHER: Wanderlust Elopements | vendor_id=deff84c7-5bd9-4689-880f-148afe62cf98 | bot=bot2 | date=1/2025 ===
# Wanderlust Elopements (Durango) — vendor_id=deff84c7-5bd9-4689-880f-148afe62cf98
site=https://www.wanderlustelopements.co/ | google 5★ × 33

## site pricing/package lines
Adventure Elopement Packages from Durango, Colorado | Wanderlust
Adventure elopement packages that feel less like a ceremony, and more like the start of your greatest adventure together.
We know choosing us is one of the biggest decisions you’ll make for your elopement, and we take that responsibility very seriously. We intentionally limit the number of elopements we take on each year to ensure our clients always have our full focus. Let’s plan something unforgettable.
ELOPEMENT PACKAGES START AT $4,800
ALL ELOPEMENT PACKAGES INCLUDE:
(Our packages start with a general concept - Half Day, Full Day, Multi Day - and are then custom tailored to fit each client’s unique wants during our planning process)
Elopement packages in Colorado and Utah that keep travel simple, so we can spend more time chasing light and capturing your story, no epic trek required.
Four hours of coverage
The Canyonlands Collection
FULL DAY ELOPEMENT | OUR MOST POPULAR
A full-day elopement adventure anywhere in the U.S. We’ll map the route, hit the trail, celebrate hard, and document every intimate, beautiful moment.
Custom-tailored photo album
The Yosemite Collection
For couples planning a destination elopement, a weekend celebration with loved ones, or an epic multi-day trek who want us there to capture every moment.
EXPLORE : Think we’re a good fit? Check out our pricing/info and then head over to our contact form to get the ball rolling.
Whether you want to elope in Colorado, Utah, or abroad, we can’t wait to work with you. Click here to see what our past clients have said about their elopement experience with us.

## google reviews (top 3)
- (5★ 2025-10) We cannot say enough amazing things about Andy and Abbi! From our very first conversation, they were an absolute dream to work with by their warm, professional, and genuinely excited to capture our day. They instantly put us at ease and made the entire process effortless. There was no overwhelming checklist or forced posing; we gave them the key details, and they handled everything flawlessly. On 
- (5★ 2025-08) Andy and Abbi came highly recommended to us from close friends in which they captured stunning photos of their engagement and wedding. We were thrilled to find out they would travel to a small town in Baja California for our destination wedding. We had a multi site shoot spanning 2 days that they executed flawlessly. It was important to us that they captured not only the quintessential wedding mom
- (5★ 2025-08) Andy and Abbi were so much fun to work with our wedding. We know that we did not have a typical wedding for their style of photo shoots, as we were on a farm versus in the mountains frolicking, but they really made our day special. Abbi was incredibly friendly and easy to work with, which made getting candid a piece of cake. Abbi and Andy gave great feedback during one on one photos during our cou

=== PHOTOGRAPHER: White Starfish Photography | vendor_id=a2cd4054-89fa-4299-859a-32f681221555 | bot=bot3 | date=4/2026 ===
# White Starfish Photography (Vail) — vendor_id=a2cd4054-89fa-4299-859a-32f681221555
site=http://www.whitestarfish.com/ | google 5★ × 24

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2020-01) Bex did such an amazing job with our engagement photos! She was such a pleasure to work with right off the bat, from offering great locations to shoot (as I’m not a Vail native) and being so accommodating when I kept changing my mind. When we met her in person, I knew we had made the right choice going with White Starfish Photography, as she was so sweet and made both my fiancé and I feel at ease 
- (5★ 2018-10) Bex made our first mountain family photo session awesome! She was very flexible and easy to coordinate with, knowledgeable about locations, and the leaving the time of day up to her was fantastic for getting the best lighting conditions possible. She did a great job engaging with our kiddos (5 and 8) and we got super-cute shots that will now appear on our holiday cards! The turnaround for the prev
- (5★ 2017-07) We loved Bex and our time with her. I emailed lots of photographers in Vail looking for someone to take my daughter's senior photos there. I liked the way Bex did her packages the best, so chose her based on that. My daughter was very worried and feeling self-conscious the day of the shoot, but Bex made is all better. She was charming, sweet, easy-going, and professional. Can't wait to see the pho

=== PHOTOGRAPHER: Wild Bliss Photography | vendor_id=d68c40a5-b368-4738-8419-2ff67d3b25af | bot=bot4 | date=2/2026 ===
# Wild Bliss Photography (Fort Collins) — vendor_id=d68c40a5-b368-4738-8419-2ff67d3b25af
site=http://www.wildblissphotography.com/ | google 5★ × 86

## site pricing/package lines
Couples engagement session (for packages of 6+ hours)
Inquire for full price list
After we have chatted and you decided we are a good fit, we will put together your contract. It is all delivered to you electronically and then you will be able to pay your deposit online to hold your wedding date!
Save the date with a deposit

## google reviews (top 3)
- (5★ 2024-10) Jessica and Candice with Wild Bliss have done my engagement photos, my wedding photos, and even branding photos/headshots for my job- and they have killed every single shoot! They truly are amazing! For our wedding, they truly went above and beyond taking all the important individual and family shots in the short span of time before we lost light. We just received our sneak peak are in love with h
- (5★ 2025-12) Wildbliss is one of the best photography companies in Colorado. We booked them for our wedding after looking through their social media platforms and photos shared from the venue and they knocked it out of the park. Our package we also included an engagement photo session. Candice and Jessica we're incredibly helpful in getting the correct poses for us, and running with a provided list of images w
- (5★ 2024-12) We LOVE our family photos from Wild Bliss Photography!! I happened to see a promotional email from Wild Bliss and booked a mini session for October 2024. That session got rained out so we rescheduled for November. Unfortunately, I had 2 family members pass away so we had to reschedule again. Jessica and Candice were so sweet and the third time was the charm! We're a large brood and they captured e

=== PHOTOGRAPHER: Wild Fern Photo Co | vendor_id=4b832df4-ff5e-4960-b793-13a6773e1643 | bot=bot5 | date=10/2025 ===
# Wild Fern Photo Co (Fort Collins) — vendor_id=4b832df4-ff5e-4960-b793-13a6773e1643
site=http://wildfernphotoco.com/ | google 5★ × 10

## site pricing/package lines
Yes! We would love for you to get a feel of what your final gallery might look like. Typically we deliver in the range of 60 images per hour of coverage. Our goal is to make it easy to relive your wedding day in detail for years to come.
Packages and Pricing
10 hours of coverage
9 x 12 custom heirloom album
Complimentary Engagement session
No additional travel fees
(1) 12x8 heirloom album & custom design consultation

## google reviews (top 3)
- (5★ 2025-08) Kim and Kyle are our dear friends, so writing a professional review for them is such a huge honor. For the sake of this review, I’m going to think about our wedding photography experience from a purely professional stance and try to leave out how, as friends, these two are warm, kind, funny, and so caring. Kim and Kyle helped me and my now-husband Andrew plan our shots before they happened. We had
- (5★ 2023-12) Kim and Kyle are super friendly and easy to work with. Kim has a beautiful eye for color juxtaposition, with a focus on detail that results in stunning pictures that felt incredibly easy and natural to shoot. My boyfriend and I had never done a professional shoot before and didn't know what to expect - and Kim and Kyle made the entire experience into a true adventure by venturing into the high cou
- (5★ 2022-12) I used Kim for my wedding in September. To say that my pictures are gorgeous and everything I had ever dreamed of is truly an understatement. She was great to deal with during the planning stages. On the day of, Kim was prompt and professional. She was fun to work with and made everyone feel very comfortable. She was great at picking out locations and finding unique shots. She also was wonderful a

=== PHOTOGRAPHER: Wild Iris Media | vendor_id=251adf35-8789-49b5-95aa-86dbb48c6643 | bot=bot6 | date=9/2025 ===
# Wild Iris Media (Boulder) — vendor_id=251adf35-8789-49b5-95aa-86dbb48c6643
site=http://wildirismedia.com/ | instagram=@the.irisphotography | google 5★ × 7

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2024-08) Very communicative, super laid back, total fly on the wall and will work around whatever YOU are looking for. My husband and I hired Mike for our wedding and can't say enough good things. He's got such a unique eye given his editorial background and had a very different style from other photographers we checked out. He's got a great knack for capturing emotional moments that happen aside from the 
- (5★ 2025-10) Our planners had the opportunity to work with Mike at a wedding in Boulder, Colorado and he was so wonderful to work with! He was quick to communicate, he prioritized the shots that the couple wanted, and was so nice. We really appreciate how great and easy he was to work with and our couple loved having him at their wedding! Thank you, Mike, for your hard work! We hope to work with Wild Iris Medi
- (5★ 2025-07) Mike was fantastic to work with. Met with us multiple times prior to the wedding to make sure he understood the timeline and key shots we wanted to have. Day of he was great, got amazing shots and even took us to this beautiful area in Boulder canyon after the ceremony for some amazing nature shots. Overall he was incredible to work with and we can’t recommend him enough :)

## region pricing digests
- [launchintel] Wild Iris Media | Starting at $1,200 (per The Knot)

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-14.csv
