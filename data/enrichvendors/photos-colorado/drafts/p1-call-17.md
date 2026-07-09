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


=== PHOTOGRAPHER: Mountain Marta Photography | vendor_id=45950ed9-be51-47eb-97f0-2acbb13efe3c | bot=bot3 | date=12/2025 ===
# Mountain Marta Photography (Colorado Springs) — vendor_id=45950ed9-be51-47eb-97f0-2acbb13efe3c
site=https://mountainmartaphotography.com | instagram=@mountain.marta.photography | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Mountain Marta Photography | Vibrant, true-to-life style | https://mountainmartaphotography.com

=== PHOTOGRAPHER: MSW Photos (Matt Wilson) | vendor_id=a78dc21e-4e68-482c-8b0f-87e3e7dfe875 | bot=bot4 | date=1/2026 ===
# MSW Photos (Matt Wilson) (Denver) — vendor_id=a78dc21e-4e68-482c-8b0f-87e3e7dfe875
site=https://www.mswphotos.com | google ?★ × ?

## site pricing/package lines
This can be an engagement session or just a couple&#8217;s session. Bring the pets if you like!
This can be an engagement session or just a couple&#8217;s session.

## region pricing digests
- [launchintel] MSW Photos (Matt Wilson) | $4,000 starting per WPJA; award-winning adventure wedding photographer, photographed in 9 states; fashion/product photography background, off-camera lighting for dusk/golden hour shots; inclusive | https://www.mswphotos.com

=== PHOTOGRAPHER: Nina Reed / Larsen Photo Co. | vendor_id=5ed84b04-5da0-41ad-a82b-f4a25e9741df | bot=bot5 | date=1/2025 ===
# Nina Reed / Larsen Photo Co. (Boulder) — vendor_id=5ed84b04-5da0-41ad-a82b-f4a25e9741df
site=https://ninareed.com | google ?★ × ?

## site pricing/package lines
Colorado Elopement Guide
for couples who love the idea of an elopement, but also want to include their favorite people in part of their wedding day.
Colorado micro weddings are the perfect combination of an elopement and a traditional wedding.
If you think we&#8217;d be a good fit, contact me and I&#8217;ll send you a full pricing guide. If I&#8217;m in your budget, we&#8217;ll schedule a video call so we can get to know each other, talk more about what you&#8217;re planning, and make sure you want me as your micro wedding photographer.
After your wedding, you&#8217;ll get edited sneak peeks within two days, and the full gallery within six weeks. Most of my photography collections also include an heirloom wedding album , because I think it&#8217;s super important for your photos to not just live in the cloud.
Colorado Micro Wedding Collections
30-page heirloom wedding album
20-page heirloom wedding album
The following can be added onto any collection:
Heirloom wedding albums
Yes! I would hope it&#8217;s pretty obvious from my whole website that I love working with LGBTQ+ couples, but I also have a whole page on LGBTQ+ elopements here .
Getting married at a vacation rental is cooler in theory (but not if you force it to be). There are a handful of epic homes on airbnb and vrbo in Colorado that are suited for and allows a micro-weddings, but these come at a premium price and with limited availability.
Secure rentals (tables, chairs, dinnerware, barware, ceremony decor), pick everything up, and setup the ceremony and/or reception on the day of your elopement.

## region pricing digests
- [launchintel] Nina Reed / Larsen Photo Co. | $5,500 starting per WPJA; 300+ weddings across Rocky Mountains; LGBTQ+ inclusive; film + digital hybrid; elopement location guides/planning help; no travel fee for Aspen elopements | https://ninareed.com

=== PHOTOGRAPHER: Photography: Family, Engagement, Wedding, Portrait etc. | vendor_id=0c2ff9e0-ae51-4f0e-9a96-5b8299958264 | bot=bot6 | date=2/2025 ===
# Photography: Family, Engagement, Wedding, Portrait etc. (New Castle) — vendor_id=0c2ff9e0-ae51-4f0e-9a96-5b8299958264
site=none | google 5★ × 15

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2019-07) My husband and I eloped in Truckee earlier this year and had 18 of our closest family/ friends there with us. I knew working with Marta was going to be so much fun right from our first conversation. She guided me in choosing the right package for my needs and I appreciate that she asked me questions that made my creative thoughts start to flow. By the time we ended our consult conversation, I felt
- (5★ 2019-09) Our wedding was wonderful, and Marta's photos reflect the happiness and vibrancy of the day absolutely perfectly. She was so easy to work with, had the best attitude, and helped us feel at ease throughout our engagement shoot and the entire wedding day. I chose to not hire a wedding planner, so I relied on my vendors pretty heavily to help suggest day-of timing that made sense with the flow of wed
- (5★ 2018-07) Marta is absolutely fantastic! We hired her to surprise our Dad for Father's Day with family photos and couldn't have hoped for anyone better. She immediately connected with our family, was great at reigning in everyone and the kids all while making sure we were having a blast and laughing. She really made the whole experience so fun. We received the digital photos very quickly (within a few days)

=== PHOTOGRAPHER: Photos by Elliot | vendor_id=278823e4-6083-4dfb-939b-7d33a48e841a | bot=bot7 | date=6/2025 ===
# Photos by Elliot (?) — vendor_id=278823e4-6083-4dfb-939b-7d33a48e841a
site=https://elliotphotos.com | google ?★ × ?

## site pricing/package lines
I believe in clarity and respect which means no surprise fees. Your quote will include the following for all packages:
4-HOUR WEDDING COVERAGE — $2,800
6-HOUR WEDDING COVERAGE — $3,400
8-HOUR WEDDING COVERAGE — $5,200
The full day, start to finish. 700+ edited images, print release, online gallery with delivery within 3 weeks. The complete record of your day.
ELOPEMENT — HALF DAY — $2,200
Up to 4 hours of coverage for your ceremony and portraits. Includes a location scouting and planning consultation so the setting and moment are exactly right. 250+ edited images, print release, delivery within 3 weeks.
ELOPEMENT — FULL DAY — $3,800
SMALL WEDDING/ELOPEMENT MINI SESSION — $1375
Nostalgic 35mm film scans + prints- inquire for pricing! ( Depends on a lot of factors, the biggest being fluctuations in price of film stock, but that feel is unmatched by digital cameras )
Professionally designed wedding albums (but I offer printer recommendations if you want to design yourself!)
Travel fees depend entirely on where we are during the year when your event is scheduled.
This is determined on a case-by-case basis, but we always stay fair and don’t price gouge here or anywhere.
I do full-day coverage, intimate elopements, and sometimes fully custom work for couples whose love story doesn't have a pre-existing mold.
Talk to Henry to see if we can create a custom package that fits both our needs. Worth a try, right? I’d love to hear what you have in mind.
Your wedding date is not reserved until a contract is signed and your non-refundable retainer fee is paid. This is industry-standard.

## region pricing digests
- [launchintel] Photos by Elliot | documentary style, bold and colorful, ~10 years shooting weddings, pricing listed on website within budget | elliotphotos.com

=== PHOTOGRAPHER: Prism Create | vendor_id=03a06266-d89e-4997-b55e-e2ce7905fe99 | bot=bot8 | date=5/2025 ===
# Prism Create (?) — vendor_id=03a06266-d89e-4997-b55e-e2ce7905fe99
site=https://prismcreate.carrd.co | google ?★ × ?

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: Roman Photography | vendor_id=cc7257a2-b78f-4069-ae95-c5136e6d0017 | bot=bot9 | date=5/2025 ===
# Roman Photography (?) — vendor_id=cc7257a2-b78f-4069-ae95-c5136e6d0017
site=https://romanphotography.com | google ?★ × ?

## site pricing/package lines
Rates &#038; Contact &#8211; Roman Photography
Rates &#038; Contact
All packages include the following. Please complete the form to contact me for rates & more details.
• Full rights & print release giving you unlimited & unrestricted usage of your images for making prints, albums, posting online, etc

## region pricing digests
- [launchintel] Roman Photography | documentary wedding photographer, photojournalism background, covers Denver with no travel fee | romanphotography.com

=== PHOTOGRAPHER: Sarah Godfrey Photography | vendor_id=f9d0dc1c-642e-4822-843b-f6366ea4c9a6 | bot=bot10 | date=6/2026 ===
# Sarah Godfrey Photography (?) — vendor_id=f9d0dc1c-642e-4822-843b-f6366ea4c9a6
site=https://sarahgodfrey.net | google ?★ × ?

## site pricing/package lines
Save the Date & Schedule Your Engagement Session
wedding collections start at $3800
Since every wedding is unique, I also build custom collections. Payment plans are available!
Brainard Lake Engagement Session in Colorado - Niko & Valerie
Brainard Lake Engagement Session | Colorado Engagement Photographer - sarahgodfrey.net
Brainard Lake Engagement Session | Colorado Engagement Photographer
Downtown Milwaukee Engagement Session | Milwaukee Engagement Photographer &raquo;

## region pricing digests
- [launchintel] Sarah Godfrey Photography | lighter/true to color style; plenty of options under 5k | sarahgodfrey.net

=== PHOTOGRAPHER: Savannah Chandler Photography | vendor_id=1a8c86d4-b4b4-4833-91c7-5d6f78ee7dff | bot=bot11 | date=6/2025 ===
# Savannah Chandler Photography (?) — vendor_id=1a8c86d4-b4b4-4833-91c7-5d6f78ee7dff
site=https://savannahchandlerphotography.com | google ?★ × ?

## site pricing/package lines
Colorado Mountain Wedding Elopement Guides &raquo; Colorado Mountain Elopement and Wedding Photographer
Mountain Elopement Guides
Elopement and Wedding Photographer Mountain Colorado
Did you know that each area of Colorado looks completely different? And has vastly different regulations regarding elopements and wedding photography.
Interested In: Mini Local Elopements: $3000 Half Day Elopements: $4200 Full Day Elopements: $7000 Multi-Day Elopements: $10500
Colorado Wedding Photographer &raquo; Colorado Mountain Elopement and Wedding Photographer
Yay! I'm so excited to be celebrating your wedding day together! To reserve your date, I ask for a $1300 retainer, with the rest being due anytime up until 30 days before your wedding. You can access your invoice and contract at any point in time.
I believe in full pricing transparency and making things as easy as possible.
The Wedding Collection
That's right, one single Wedding Collection.
I try to include everything you need on your wedding day without having to think about add-ons or hourly limits.
Hourly limits suck. I don't want you to have to try and squish things into a timeline just to make sure you get photos of certain activities.
Wedding Collection Pricing
want to add an engagement Session or rehearsal Dinner coverage?
Add an engagement session, a hiking session after your wedding, photographic coverage of your rehearsal dinner, or an album - each is a $1200 add on to any wedding collection and can be added on at any time. Happy to get you more details.

=== PHOTOGRAPHER: Shelly M Photography | vendor_id=5d50b080-2ad5-430f-9e8a-ba166a76dc2d | bot=bot12 | date=11/2025 ===
# Shelly M Photography (?) — vendor_id=5d50b080-2ad5-430f-9e8a-ba166a76dc2d
site=https://shellymphotography.art | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Shelly M Photography | airy but real life color vibe | shellymphotography.art

=== PHOTOGRAPHER: Stephanie Tod Photography | vendor_id=d9bfa45e-cb0e-4f5a-bac2-884da8ac2982 | bot=bot13 | date=6/2026 ===
# Stephanie Tod Photography (?) — vendor_id=d9bfa45e-cb0e-4f5a-bac2-884da8ac2982
site=https://stephanietodphotography.com | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Stephanie Tod Photography | recommended for lower budget range ($1,500-$3,500) | stephanietodphotography.com

=== PHOTOGRAPHER: Taylored Wedding and Portraits | vendor_id=8b8bae22-e4ba-4a41-ba89-f292b8541c00 | bot=bot14 | date=8/2025 ===
# Taylored Wedding and Portraits (Denver) — vendor_id=8b8bae22-e4ba-4a41-ba89-f292b8541c00
site=https://tayloredwedding.com | instagram=@tayloredwedding | google ?★ × ?

## site pricing/package lines
Weddings & Elopements
The Process Investment Travel
Abso-freaking-lutely! I love to travel and have been lucky to travel up to 50 countries so far! I love nothing more than immersing myself in the culture of a new place and would love to experience it with you. Travel fees are dependent upon where your shoot is located, but I am always up for a trip.
If you cancel your wedding/elopement (we hope this never happens) the deposit is non refundable. If you need to reschedule your wedding/elopement, there is a $500 rebooking fee if you have booked me during a weekend from June-August.
If you cancel a portrait shoot within 48 hours, the deposit is non refundable. If you need to reschedule a portrait shoot, there is no rebooking fee.
Starting at $3750 for regular weddings. Please contact Piper for pricing of Micro-Weddings (less than 35 people).
Starting at 1.5 hours
Starting at $400 for engagements. Contact Piper for mini session pricing.
Starting at $375. Contact Piper for mini session pricing and combined packages for newborn & maternity.
Starting at 30 minutes
Starting in 2025 I am now offering film add ons for all sessions at the following prices:
1 Roll of 35mm film (black and white or color) + development & scans: $50
2 Rolls of 35mm film (black and white or color) + development & scans: $95
3 Rolls of 35mm film (black and white or color) + development & scans: $125
Ask about pricing for 4 Rolls of 35mm film or more
Weddings ~ Elopements ~ Maternity ~ Newborn ~ Families ~ Headshots ~ Branding ~

## region pricing digests
- [launchintel] Taylored Wedding and Portraits | Timeless editorial style | https://tayloredwedding.com

=== PHOTOGRAPHER: Tom K Photo | vendor_id=aba1df06-2e10-4198-965e-415b6ae445ba | bot=bot15 | date=6/2026 ===
# Tom K Photo (Boulder) — vendor_id=aba1df06-2e10-4198-965e-415b6ae445ba
site=https://www.tomkphoto.com | google ?★ × ?

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

## region pricing digests
- [launchintel] Tom K Photo | Documentary-style coverage; coverage options from 3 to 12 hours, multiple photographers, photo prints, hanging canvas prints, custom wedding books | https://www.tomkphoto.com

=== PHOTOGRAPHER: Tomi Photopositive | vendor_id=ff269248-b017-43bd-b698-e2589bd04d75 | bot=bot16 | date=12/2025 ===
# Tomi Photopositive (Denver/Broomfield) — vendor_id=ff269248-b017-43bd-b698-e2589bd04d75
site=https://www.tomiphotopositive.com | instagram=@tomi.photopositive | google ?★ × ?

## site pricing/package lines
PRICE AND PACKAGES - Tomi Photopositive
Wedding - Gold Package
10 hours package - 3.400$
* Second photographer can be added for 150$ per hour
Wedding - Silver Package
8 hours package - 3.000$
Wedding - Bronze Package
6 hours package - 2.600$
Wedding - Diamond Package
10 hours package + 5h second photographer - 5.000$
- One lead photographer for up to 10 hours + One second photographer for up to 5 hours
- 1.5h Engagement Session
1.5 hours package - 600$
http://www.tomiphotopositive.com/investments

## region pricing digests
- [launchintel] Tomi Photopositive | Photojournalistic style; starts at $2,100-$2,500 ($2,500 for Boulder area); 500+ weddings; warm true-to-life editing; packages include 2 photographers, 1,300 final edited images, private gallery with 50 sneak-peeks within 3 weeks | https://www.tomiphotopositive.com

=== PHOTOGRAPHER: Vail Mountain Wedding Deck | vendor_id=1a3b19dc-e80d-4285-ac9e-e9ddf90cae47 | bot=bot17 | date=1/2026 ===
# Vail Mountain Wedding Deck (Vail) — vendor_id=1a3b19dc-e80d-4285-ac9e-e9ddf90cae47
site=none | google 4.6★ × 21

## site pricing/package lines
(none found on site)

## google reviews (top 3)
- (5★ 2025-08) As a wedding photographer based in the Vail Valley, I’ve had the privilege of documenting love stories in some truly stunning locations—but there’s something uniquely special about the Vail Wedding Deck. Perched high above the valley with panoramic mountain views, it’s an unforgettable setting for an intimate wedding ceremony, surprise proposal, or engagement session. One of the things I love most
- (5★ 2024-08) As a Vail wedding photographer, the wedding deck is my top favorite ceremony venue in Vail! The views are absolutely breathtaking (both literally and figuratively at 10k+ feet). Guests are always wowed and awed at the beauty and it's one-of-a-kind spot for saying "I do!" I can't wait to photograph more weddings here on film.
- (5★ 2020-08) I am a Live Wedding Painter, and have been hired several times to paint this spectacular view with newlyweds. I always enjoy coming to this venue, as it is easily accessible and just gorgeous! I hope to paint there many more times! Find me, I'm the Colorado Wedding Painter !

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-17.csv
