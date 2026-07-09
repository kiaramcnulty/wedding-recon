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


=== PHOTOGRAPHER: Elevate Photography | vendor_id=e2a067d1-33d1-495a-b186-6c8671361049 | bot=bot8 | date=1/2026 ===
# Elevate Photography (Littleton) — vendor_id=e2a067d1-33d1-495a-b186-6c8671361049
site=http://www.elevatephotography.com/ | google 5★ × 117

## site pricing/package lines
Pricing - Elevate Photography
At Elevate Photography, our pricing is designed with simplicity and value in mind—transparent, straightforward, and crafted to give you stunning images without the guesswork.
Save $250 when you book photography + content creation or videography.
Save $500 when you book three!
All Packages Include
Allows you to share your photos with friends and family, order prints and albums and download your hi-res photos. View Example
Additional Time - $350/hr
2nd Photographer - $150/hr
1 Hour Engagement - $500
2 Hour Engagement - $800
Reception Display - $250
Essential Album - $750
Signature Album - $1,500
Legacy Album - $2,500
Additional Hour $500
1 Hour Engagement $700
2 Hour Engagement $1,000
Standard Album - 10x10, 30 pages, linen or photo cover, self designed $750
Classic Album - 10x10, 30 pages, linen, leather or photo cover, professionally designed $1,500
Deluxe Album - 12x12, 40 pages, linen, leather or photo cover, professionally designed $2,500
Photo Booth - includes set-up/tear-down (50 mile radius), props and background $700
Additional Hour $350
2 Hour Engagement $750
Book both photography and videography to get a $250 discount at checkout.
Full Day Recap (1 Minute)
Additional Time - $250/hr
Full Day Recap - $300
2nd Videographer - $150/hr
Toast & Dance Videos - $400
Interested in an Engamement Shoot that is not part of a wedding package? Email info@elevatephotography.com to schedule a photographer
• Travel is charged at $1/mile round trip to your reception location.
• If you have a second shooter, the travel fee is doubled.

## google reviews (top 3)
- (5★ 2024-12) We worked with Emily from Elevate and we had an amazing experience! From the first moment we met Emily, we felt comfortable with her and knew she would do an amazing job. We loved that there were different packages offered and could add additional time or other extras. The instant sneak peak was a hit at our wedding! During the engagement session, Emily was able to help us pick a perfect location 
- (5★ 2025-11) We had the BEST time with Elevate Photography! We couldn’t have asked for a better experience and couldn't recommend them enough! From our engagement session to our wedding day, Bethany went above and beyond in every possible way. She made us feel completely at ease in front of the camera and somehow managed to capture every genuine moment — the big emotions, the little details, and everything in 
- (5★ 2026-05) Elevate Photography was amazing! I really valued having an excellent photographer at our wedding and Elevate totally delivered. Our photographs turned out truly incredible! The style of the pictures was exactly what we discussed and we had so many final photographs given to us. From the beginning Elevate showed us that they would be a great choice. We were able to meet with our photographer before

## region pricing digests
- [launchintel] Elevate Photography | Photojournalistic style; starts at $2,500; photography and video; fun-focused approach

=== PHOTOGRAPHER: Ellie Rich | vendor_id=78d00bf3-4467-4ecd-a129-b3ead9b148b8 | bot=bot9 | date=5/2026 ===
# Ellie Rich (Denver) — vendor_id=78d00bf3-4467-4ecd-a129-b3ead9b148b8
site=https://www.ellierich.com/ | google 5★ × 69

## site pricing/package lines
LOVE STORIES (WEDDINGS & ELOPEMENTS) | Ellie Rich
LOVE STORIES (WEDDINGS & ELOPEMENTS)
Lear more about our Wedding and Elopement Photography on Mr & Mrs RICH website .
You can find our Luxury Wedding & Elopements photography HERE

## google reviews (top 3)
- (5★ 2023-06) Ellie is such a talented artist! Because she is both a photographer and a model, she really has a deep understanding on how to pose and capture individuals perfectly. She goes above and beyond in editing the photos to give off the perfect vibe. Ellie’s so sweet and fun to talk to. Her and Dillon were both such great people to work with. Her pricing is extremely fair considering the level of work t
- (5★ 2025-12) We had the most incredible experience with our maternity shoot done by both Ellie and Dillon! We are not the most photo savvy of people, but Ellie and Dillon were beyond kind, thoughtful, and patient with us through the shoot. They exhibit mastery of their craft, and they consistently demonstrated both professionalism and creativity. The photos they chose and edited for us were beyond stunning and
- (5★ 2026-01) Ellie and her husband were absolutely wonderful to work with. Throughout the entire shoot, they made me feel completely comfortable and at ease. When I received my photos, I was blown away by how beautifully they turned out—truly stunning work. I’m already looking forward to booking my next session with them.

=== PHOTOGRAPHER: Emberlight Media | vendor_id=e4b9c30e-cd64-4112-af0e-05c7f9563d18 | bot=bot10 | date=1/2025 ===
# Emberlight Media (Denver) — vendor_id=e4b9c30e-cd64-4112-af0e-05c7f9563d18
site=https://www.emberlightmedia.com/ | google 5★ × 28

## site pricing/package lines
Wedding photography is one of the most important investments you’ll make on your wedding day! It’s what you share, print, and preserve for a lifetime
Portable Power Unit - $100
Drone Addition - $500
Wireless Camera - $300
Additional Hour - $300 per operator
Priceless. They captured our day perfectly.
"The team went above and beyond every expectation. They captured the moments of our day perfectly and worked seamlessly together. They were prompt, professional, and truly priceless. Watching our video feels exactly like being back in the moment!"

## google reviews (top 3)
- (5★ 2026-02) Emberlight Media is the rebrand of All Digital Photo & Video, and their experience plus reliability shine. While their new site highlights beautiful wedding photography and videography, our work with them has been on the corporate, commercial, and live event side— and they excel in that environment. Devin, Jared and team have photographed and filmed dozens of our corporate events, conferences, and
- (5★ 2026-04) Paul was our wedding photographer and did a tremendous job! He was excellent to work with and great with helping us do poses! It was a windy day and yet the photos turned out so beautiful! Highly recommend Paul to be your photographer! Devin did an absolutely tremendous job capturing everything we had asked for and more from our wedding day. The video brings you right back to the day!! The emotion
- (5★ 2026-05) Working with Emberlight couldn't have been any easier. I described my project and need and Devin got it right away. He assigned a thoughtful and talented photographer to the project, who was barely noticeable during the actual event yet took the perfect pictures and video. Devin was communicative throughout the process, the price was fair, the photographer was on-time and clearly cared about doing

## region pricing digests
- [launchintel] Emberlight Media | Photojournalistic style; starts at $945; photography and video; in business since 1999

=== PHOTOGRAPHER: Embodied Art Boudoir | vendor_id=12717c71-19a5-43cd-b8b2-4cb29de86341 | bot=bot11 | date=6/2026 ===
# Embodied Art Boudoir (Golden) — vendor_id=12717c71-19a5-43cd-b8b2-4cb29de86341
site=https://embodiedartboudoir.com/?utm_source=Google%20Maps&utm_medium=organic&utm_campaign=Evergreen | google 5★ × 72

## site pricing/package lines
The Embodied Art Experience is $2900 (sales tax not included).
This is an all-inclusive experience designed to guide you through a full day of intention, embodiment, and artistic expression. Your experience includes:
• A luxury 8&#215;8 custom album with 20 images
Many clients fall in love with more than 20 images, and you’ll always have the option to upgrade your album, add digital images, or choose wall art.
To make the experience more accessible, zero-interest installment plans are available , allowing many clients to spread the investment out over several months.
Once you secure your session date with a deposit, the remaining balance can be split into monthly or biweekly payments leading up to your session . Because many sessions are scheduled months in advance, this often makes the investment feel much more manageable.
However, I love the idea of a reveal get-together where you make a fun event out of sharing your album with your friends/sister/mom/partner!
Boudoir photos, like albums, make an amazing gift!! Many of my clients come to me to create an album they can gift their partner for a wedding , anniversary, birthday, or holiday like Christmas or Valentines Day.
The Embodied Art Experience includes a luxury album with 20 images , because I believe your artwork deserves to exist in the physical world — not just on a hard drive.
There’s something powerful about being able to hold your story in your hands or see it displayed in your space. Many clients tell me their album becomes a reminder they return to again and again.

## google reviews (top 3)
- (5★ 2026-05) If you want to feel like the Goddess you are and truly be seen through the eyes of the best hype woman, Gabby is the best to take you through a transformational photo shoot! Before working with her, my biggest fears were the potential discomfort of the session and simply not liking the end results. I was coming from a place of not feeling confident or sexy in my own skin, following a difficult end
- (5★ 2026-05) 10/10—I really can’t wait to share this opportunity with others! Gabby helped me bring my vision to life and bring out my strength through authentic expression, coaching me through discomfort and helping me remember exactly what I wanted to achieve with these photos. My biggest fear going in was that this was not going to materialize as a good brand kit, or that I would still look uncomfortable on
- (5★ 2026-02) My experience with Gabby was nothing short of powerful. From our first phone call, I knew this wasn’t just a photoshoot—it was an intentional, deeply personal process. Gabby took the time to truly know me, not just how I wanted to look, but who I am and what I wanted to feel. Her energy alone made me feel safe, comfortable, and celebrated. Every step of the experience was about honoring me in a wa

=== PHOTOGRAPHER: Emerald Fox Boudoir | vendor_id=fb2e9c70-84ab-4685-8b99-198153145073 | bot=bot12 | date=5/2025 ===
# Emerald Fox Boudoir (Aurora) — vendor_id=fb2e9c70-84ab-4685-8b99-198153145073
site=http://emeraldfoxboudoir.com/ | google 4.9★ × 118

## site pricing/package lines
Albums, glass heirloom boxes, metal wall art, calendar and digital images! For complete pricing information, schedule a phone consult with me HERE .
Yes! We have VERY flexible payment plans, actually! They start at just $50/month and you will actually get to receive all your products and images  before you are paid in full!
You can book by submitting the contact form on our website. After that, we’ll schedule a consultation call to go over details, answer questions, and secure your session date with a retainer fee.
Yes. We offer flexible payment options for image collections and products to make your investment more manageable.
We understand that life happens. Rescheduling requests must be made within the   timeframe   outlined in your contract. Retainer fees are non-refundable, but may be transferred to a new date, if you make that request with enough time before your session.
Our session fee is $500 and includes everything that happens on the day of your shoot!
We won&#8217;t say &#8220;Now go sit on the couch and look sexy!&#8221; That&#8217;s just not nearly enough information, is it? Instead, we will choose from a collection of poses, demonstrate the pose and talk you through it when it&#8217;s your turn!
Choose any of our products as a Collection or from our Ala Carte Menu! Our Collections begin at $350 and our digital images packages begin at $650. We also offer payment plans to help with this part!
Our plans are offered at 0% interest and have a $0 financing fee. Simply choose whatever package you like and if you can pay 25% of the entire package price, you&#8217;ll actually receive your digitals immediately and products will be sent to the lab for printing.

## google reviews (top 3)
- (5★ 2026-05) I was unsure how comfortable/confident I would feel during the experience and was a little nervous I wouldn't like many of the photos. Well, was wrong on both accounts. The whole team was great. I liked my hair and makeup, I appreciated that the staff helped me choose my outfits, and the assistant demo'd poses which made everything feel easier. Everyone was kind and reassuring and helped me feel c
- (5★ 2026-06) This was my second time booking with Emerald Fox Boudoir, and once again I had an amazing experience! The atmosphere was welcoming, comfortable, and so much fun. The photographer (Ali) does a wonderful job helping you feel confident and relaxed in front of the camera, making the whole session enjoyable from start to finish. I never felt awkward or rushed, and it was clear that a lot of care and at
- (5★ 2026-04) I received a giveaway, so I got a chance to be super pampered in every sense! I was very nervous going in, but everyone has been so kind, professional, and patient throughout the entire experience. Once we started, I felt very much at ease with my photographer and her team. The posing coaching was on point - the pictures were amazing! I went into this with a very negative relationship with my body

=== PHOTOGRAPHER: Emily Elizabeth Images | vendor_id=083f1531-2147-434f-a4a3-435e5984cb0d | bot=bot13 | date=11/2025 ===
# Emily Elizabeth Images (Boulder) — vendor_id=083f1531-2147-434f-a4a3-435e5984cb0d
site=https://emilyelizabethimages.com/ | instagram=@emilyelizabeth__photography | google 5★ × 4

## site pricing/package lines
Investment | Book Your Session Now &mdash; Emily Elizabeth Images
No travel fee for locations within 1 hour of Boulder
Starting at 2h session
$250 for each additional hour beyond 2 hours
Small Weddings & Elopements
Wedding Package Guide available upon request
Please contact for current pricing.
Wedding & Elopements
Heartfelt, authentic storytelling with both candid and classic images of your wedding day. Packages available for 3-10 hours of coverage, for weddings big or small.

## google reviews (top 3)
- (5★ 2026-03) Emily did our newborn photo shoot for our firstborn son near Red Rocks. She was very easy to work with, professional and made the whole shoot feel relaxed and easy. She has a unique artistic eye for beauty and was able to capture our family in a way that was authentic and timeless. Also the settings for the pictures/ nature scenes were stunning and she advised on the best color combinations that w
- (5★ 2026-03) I love working with Emily!! We’ve done a couple sessions with her - she did my maternity photos and made me feel so comfortable and so beautiful. She was able to prompt my husband and I to get genuine laughs and poses. Then the candid natural shots she got of my son during a family session are my absolute favorites, catching his joy and silliness. She’s super responsive too, which is so appreciate
- (5★ 2026-06) We had a great experience working with Emily for our engagement photos. She worked with me to reschedule THREE times so we could have the perfect weather for our shoot. Emily was very communicative throughout the process and we are so pleased with our photos. Highly recommend!

=== PHOTOGRAPHER: Emily O Photography | vendor_id=db3a69d6-1148-4cfe-b904-8e0406f605c5 | bot=bot14 | date=10/2025 ===
# Emily O Photography (Fruita) — vendor_id=db3a69d6-1148-4cfe-b904-8e0406f605c5
site=https://www.emilyophotography.com/ | google 5★ × 23

## site pricing/package lines
I'm looking forward to meeting your family and hearing your story. Let's start adding to the pages of your family album!

## google reviews (top 3)
- (5★ 2025-07) I highly recommend Emily if you are in need of professional pictures in the Mesa County area. Emily was beyond professional and accommodating during my maternity and newborn photos. We ended up going for newborn picture with a 3 week old, let me tell you I was nervous! I don’t think anyone could have done a better job! She settled our little girl into a deep sleep and got some of the most adorable
- (5★ 2025-02) Emily was absolutely wonderful to work with for family photos! She was very thoughtful in asking what we wanted for our photos in terms of location, theme, colors, etc. She found the perfect location based on our requests and made it so convenient for our family. She spent a considerable amount of time with us during our photo session and made the experience so easy and fun for our kiddos. Her tur
- (5★ 2025-02) Emily did an amazing job with our son's newborn photos! Her talent in positioning newborns and capturing those precious moments is truly remarkable. We are so happy with the results and would highly recommend her to anyone looking for beautiful, professional newborn photography.

=== PHOTOGRAPHER: Fanciful Floral & Weddings | vendor_id=50237226-9aa1-4bfe-a772-5456a052ed2b | bot=bot15 | date=6/2025 ===
# Fanciful Floral & Weddings (Estes Park) — vendor_id=50237226-9aa1-4bfe-a772-5456a052ed2b
site=http://www.fancifulweddings.com/ | google 5★ × 60

## site pricing/package lines
WHAT ARE YOUR PACKAGE RATES FOR FLOWERS?
WHAT DO I DO IF I DON'T KNOW WHICH PACKAGE IS APPROPRIATE?
For anyone interested in learning more about our planning packages and floral design, don't be a stranger! Please Contact Me so we can chat! We are always happy to talk through details and options. You are not obligated to book with us in receiving a quote or having a consultation.
packages & a la carte | fanciful | custom wedding planning packages
packages & a la carte: Event Services
Add-On to any package, or Simply Pick and Choose!
Welcome Package: Creation and Delivery
Hourly Consultation(s)
All A La Carte items will vary in price depending on your specific needs. If you book a service and later decide to book a Package, any funds already paid may be applicable toward your package price.
packages & a la carte: About
Wedding Planning Packages

## google reviews (top 3)
- (5★ 2025-07) Caley made our dream wedding a reality and made our vision come to life! She had a great attention to detail. Everything was more perfect than we could have imagined! She was super knowledgeable and helpful. She recommended amazing vendors to work with when we needed ideas. Caley also thought outside the box and prepared us for everything- even stuff we would have never thought of! She was very pr
- (5★ 2022-11) Caley did a wonderful job with both the floral arrangements and the month-of-coordination for our Estes Park wedding. We really appreciated her checklists, vendor recommendations, and regular check-ins during the build-up to the wedding. She suggested things we hadn’t even considered. On the day of, she kept everything on track and helped herd our guests and wedding party with lots of tact and kin
- (5★ 2025-10) Caley did the florals, decor and the planning for our wedding in Estes Park in September 2025 and everything turned out perfectly. We had multiple people tell us "this is the best wedding I've ever been to" and we owe a lot of that to Caley. I will never get over how amazing the florals turned out! We told Caley the color scheme and vibe we were going with and she did the rest. Caley was really he

=== PHOTOGRAPHER: Fawntail Boudoir Photography | vendor_id=07d3efc8-3906-495c-8538-cebe7107ea8e | bot=bot16 | date=6/2026 ===
# Fawntail Boudoir Photography (Boulder) — vendor_id=07d3efc8-3906-495c-8538-cebe7107ea8e
site=http://www.fawntail.com/ | google 4.9★ × 31

## site pricing/package lines
Elevated Boudoir Photoshoot Experiences, Planning & Guidance | Photoshoot Pricing & How it works &mdash; Fawntail Boudoir Photography
Boudoir Experience & Pricing
Your Fawntail Boudoir Experience & Pricing
My goal is for you to feel relaxed and confident about the experience, the pricing, and your decision to be here.
✓ A curated image collection
✓ Clear, upfront pricing
No image upsells, no surprise costs, and nothing sold after your session, just clear pricing and an experience you can feel good about.
Fine art albums and books are available if you’d love a tangible way to enjoy your images. These are always optional and never expected.
A curated collection of fully edited, high-resolution digital images (typically 30-40)
An expanded curated image collection (typically 50+)
Fine Art Albums & Prints
Heirloom album: $450
Lose Prints/Wall art: Starts at $5
Add-on Polaroids $250 for 8 to any digital session
Albums are a beautiful way to preserve your images in a private, tangible form.
Professional Hair & Makeup $300
If you’d like to add on an album or prints, we’ll talk about it once you have had time to see your photos and I’ll walk you through the design process.
Once you’ve had a chance to enjoy your photos, we’ll talk about designing your book or album, or ordering prints or wall art if you want them.

## google reviews (top 3)
- (5★ 2026-03) I cannot say enough good things about my session with Petra! The whole experience was honestly so fun and relaxed. She has created such a beautiful studio space and immediately makes you feel welcome. I actually had a session with a different photographer in the area (who I won’t name) and it was a disaster. I was so scared to try again but I really want those beautiful photos I dreamt of so I dec
- (5★ 2025-03) Oh my gosh, please book a shoot! Petra was absolutely incredible! Kind, professional, talented, comforting, easygoing, and wonderful! I couldn’t be more thrilled with my photoshoot. This was a huge confidence boost and I truly don’t think I could have had a better experience. I will be recommending her to anyone and everyone who is wanting a boudoir. Thank you Petra!
- (5★ 2025-07) This was such a great experience and Petra is amazing!! She worked with me when I had a specific request and made my hopes come true! I got my hair and makeup done and I felt very listened when discussing what I was wanting and I felt very beautiful. This was an amazing experience and I got beautiful results, I will be going back to her when I have the opportunity!

=== PHOTOGRAPHER: For Wild Love | vendor_id=0d37f6a7-a7d1-497d-b216-1055167b46a2 | bot=bot17 | date=6/2026 ===
# For Wild Love (Breckenridge) — vendor_id=0d37f6a7-a7d1-497d-b216-1055167b46a2
site=http://www.forwildlove.com/ | google 5★ × 6

## site pricing/package lines
Elopement Planning Packages and Wedding Planning Packages - Colorado and Destination &mdash; For Wild Love
Elopements & Micro Weddings
Elopement & Wedding Packages
Wild Lovers Elopement Package
Cost: Starting at $4,000
Creation of wedding day timeline distributed to all vendors at least 2 weeks prior to elopement day
Micro Wedding Planning Package
Full Wedding Planning Package
Cost: Starting at $5,500
Cost: Starting at $5,000
Elopement Planner | Planning Destination Elopements & Intimate Weddings
FULL SERVICE DESIGN & PLANNING FOR WEDDINGS, Elopements & Events.
Elopement Planner at For Wild Love &mdash; For Wild Love
Wedding Planning Packages & Elopement Planning Packages &mdash; For Wild Love
Elopements & Wedding Planning

## google reviews (top 3)
- (5★ 2024-11) Winne is a top-notch elopement & micro-wedding planner!! From the start of our wedding planning journey, she was warm, prompt and professional!! She stayed on top of me when I was slacking on wedding detail decisions and made sure everything was sorted well before the big day. She made sure to have multiple virtual check-ins with us throughout the planning process. Even though she was working with
- (5★ 2023-05) Hiring Winnie to plan and design my small adventure wedding in Colorado was one of the best decisions we made. We wanted to plan an adventurous day with our close family and friends but with so many different ideas, we didn’t know where to start. Winnie was one of the first people we hired and thank goodness we did! She had incredible vendor recommendations (who were just as awesome to work with),
- (5★ 2024-09) Winnie is an amazing wedding day planner! She went above and beyond helping us to plan for our daughter’s special day and it was so beautiful! Winnie took the time to go through every single detail, right down to the smallest one, to make sure the wedding was exactly what our daughter wanted! She is very thoughtful and kind and was patient with us through all the months of planning! Her experience

=== PHOTOGRAPHER: Foss Photography | vendor_id=2f38dda0-575f-431d-8783-c48dab628f8c | bot=bot1 | date=12/2025 ===
# Foss Photography (Fort Collins) — vendor_id=2f38dda0-575f-431d-8783-c48dab628f8c
site=http://fossphotography.co/ | google 5★ × 71

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2024-01) I had seen and admired Emily's work over the years through acquaintances and friends who'd had her photograph their own weddings, so when it came time for me to plan my wedding she was up at the top of the list. From the very beginning Emily was fun and intentional and we knew that we wanted to have her and her husband Alan be a part of our day. Living out of state and planning a wedding in Colora
- (5★ 2019-01) We were married in October and Emily was our amazing photographer! She was incredibly professional from beginning to end and has this awesome ability to be fun and personable to everyone! Our pictures turned out incredible and I have had friends and family raving to me about how amazing they are! I loved that she had two photographers so no moment was ever missed and she always had an endless flow
- (5★ 2023-10) I first met Emily in 2022 and immediately gravitated toward her energy. As a fellow photographer myself, I know talent when I see it, and her work has blown me away since day 1. Emily and her husband Alan are a dream team and work together so well. They love to tell stories through their photography style, which is something I really wanted for our wedding day. Even through the unexpected rain, Em

=== PHOTOGRAPHER: Four Corners Digital Imagery | vendor_id=5fda7af9-d7f3-4146-a6fc-1153b6319c9d | bot=bot2 | date=11/2025 ===
# Four Corners Digital Imagery (Durango) — vendor_id=5fda7af9-d7f3-4146-a6fc-1153b6319c9d
site=https://www.fourcornersdigitalimagery.com/ | google 5★ × 7

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2020-12) I was amazed by the ability of Four Corners Digital Imagery. I was so happy to find someone I could trust with one of the most special moments in my life. My proposal to my future wife went stunningly and thanks to FCDI (abbreviation) my family will have this cherished moment forever. The company even edited their professional photography and drone footage fast! I couldn’t be happier with our choi
- (5★ 2020-02) We had a fantastic experience with Wes at Four Corners Digital Imagery. The final videos Wes created for us far exceeded our expectations! He was really easy to work with throughout the entire process, made us all feel at ease, and was remarkably creative! I give Four Corners Digital Imagery the highest recommendation!
- (5★ 2021-07) I've worked with Wes on two of my commercial real estate listings in the four corners region and he has consistently delivered with great quality. The drone service is a huge plus to really make listings look professional and modern. I would strongly recommend his services.

=== PHOTOGRAPHER: Four Seasons Resort and Residences Vail | vendor_id=0f504c9b-0f3b-438c-8da0-c5bcd588d195 | bot=bot3 | date=4/2026 ===
# Four Seasons Resort and Residences Vail (Vail) — vendor_id=0f504c9b-0f3b-438c-8da0-c5bcd588d195
site=https://www.fourseasons.com/vail/?utm_source=google&utm_medium=organicsearch&utm_campaign=tor-vai-hre-mid-seo-na&utm_content=na-na&utm_term=na | google 4.7★ × 1218
google summary: Refined lodging with a stylish restaurant, year-round outdoor pool, upscale spa & hiking excursions.

## site pricing/package lines
Every detail, no matter how small, matters. That’s why we take care of them for you. Our thoughtfully curated wedding package highlights the best of our services, personalized for you.
EXPLORE WEDDING Packages
Enjoy up to 20% off our Room Rate when you book your stay in advance.
Explore our curated collection of activities in Vail Village, designed exclusively for Four Seasons guests. From guided backcountry ski tours to private fly fishing and restorative spa treatments, discover unforgettable ways to experience Vail mountain in all seasons.
Winter Sport Gear Packages
Adult Snowboard Rental Package
Junior Snowboard Rental Package
Snowshoe Rental Package
From alpine hikes and mountain biking to whitewater rafting and fly fishing, summer in Vail is alive with possibility. Our curated collection of warm-weather adventures showcases the best of the Colorado Rockies, whether you’re chasing adrenaline or simply soaking up the mountain sunshine
pdf rate cards seen on site (not fetched): https://www.fourseasons.com/content/dam/fourseasons/images/web/FSH/PDFs/Four-Seasons-2026-Modern-Slavery-Statement.pdf

## google reviews (top 3)
- (5★ 2026-05) Our stay at the Four Seasons Vail was an absolutely wonderful experience from start to finish. I cannot recommend this property highly enough! From the moment we arrived, the hospitality was unmatched. Every single staff member we encountered across the property was incredibly friendly, kind, and genuinely attentive. The valet team kicked off our trip with amazing service, and that level of care c
- (3★ 2026-05) BEWARE‼️‼️ The food is REALLY REALLY REALLY EXPENSIVE and honestly not that good. There were only two restaurants open when we were there and places in the village were not open yet. We stay at nice places all the time and while we don’t mind paying for good food, the two restaurants were not it. Over $30 for a burger and also over $30 for a poke bowl (not worth it…very little tuna). 3 meals a day
- (3★ 2026-02) Omar at the front desk was the only reason I didn't give 1 star. He was so sweet, walked me to my room since the Hotel is a maze. We Struggled to find our room all weekend. Do not like the every 4 hour/mid day housekeeping service. They Moved all of our stuff around and reorganized the whole room like we were brand new guests.Thank you, but don't touch my stuff. We put the privacy please sign up a

=== PHOTOGRAPHER: Frances Photography | vendor_id=0fdbe508-cfc8-4ef0-85ec-dee7928ac19d | bot=bot4 | date=4/2026 ===
# Frances Photography (Denver) — vendor_id=0fdbe508-cfc8-4ef0-85ec-dee7928ac19d
site=https://www.francesphotography.com/ | google 4.9★ × 66

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2018-11) There really aren't enough words to say how amazing our experience with Frances was. She photographed our wedding at Copper Mountain and we could not be happier with the moments she captured. My wife and I were a little nervous to be the center of attention all day, but Frances and her team made us feel SO unbelievably comfortable which allowed her to capture us as we are (not posed and very natur
- (5★ 2022-09) Frances is incredible. If you are considering hiring her for your wedding, engagement shoot, family photos, whatever.. do it! My husband and I are both very awkward and camera-shy and Frances helped us feel comfortable and somehow captured some absolutely fabulous shots of us! She is professional & responsive while also being laid-back and easy to work with. 10/10
- (5★ 2017-04) Frances was able to turn my rainy wedding day in ATX into a perfect backdrop for photos that are out of this world. Words cannot describe the joy and love I felt seeing the story of our day unfold through our photo gallery. Thank you, Frances and team!

=== PHOTOGRAPHER: Friends and Lovers Photography | vendor_id=d0b00d01-a468-45d3-bc53-2c2a9615bdda | bot=bot5 | date=7/2025 ===
# Friends and Lovers Photography (Wheat Ridge) — vendor_id=d0b00d01-a468-45d3-bc53-2c2a9615bdda
site=http://www.friendsandloversphotography.com/ | google 5★ × 56 | SITE CRAWL FAILED (fetch failed)

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2022-11) You can stop searching now, you’ve found your photographer. Chelsey produced the most incredible photos for both our engagement and our wedding. Our engagement shoot served as an opportunity for Chelsey to get to know us so that we were comfortable with taking photos on our wedding day. Our engagement photo is still hanging on our friends’ refrigerators 2 years later! Chelsey is so accommodating a
- (5★ 2025-11) Chelsea did our Halloween/fall themed wedding elopement shoot and really went above and beyond. She learned about us, what we wanted, and made it come to life. I was so impressed with her artistic take, how she arranged our props and flowers, how she captured our romantic connection, and her way of making this shoot so unique to us. Thank you Chelsea for making our special moment so perfect! We wi
- (5★ 2025-06) Absolute perfection!! 💜🩷🤍🧡💗 I cannot overstate how perfect our Chelsey with Friends and Lovers was for our senior photos!!! Firstly, we were late to the party scheduling, but Chelsey took the time to get us scheduled. The time taken to figure out what our graduate wanted vibe wise was just right! Chelsey knew exactly where to go for the session and provided super clear details about what to b

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-06.csv
