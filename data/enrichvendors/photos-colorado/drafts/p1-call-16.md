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


=== PHOTOGRAPHER: Creative by Antonella | vendor_id=9e31c848-8237-4047-81f4-3df54ecce262 | bot=bot5 | date=7/2025 ===
# Creative by Antonella (?) — vendor_id=9e31c848-8237-4047-81f4-3df54ecce262
site=https://creativebyantonella.com | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: Eliza Wildflowers Photography | vendor_id=3a36c849-b9ef-4830-be74-e24fccc07dad | bot=bot6 | date=8/2025 ===
# Eliza Wildflowers Photography (?) — vendor_id=3a36c849-b9ef-4830-be74-e24fccc07dad
site=https://elizawildflowers.mypixieset.com | instagram=@elizawildflowers | google ?★ × ? | SITE CRAWL FAILED (HTTP 403)

## site pricing/package lines
(none found on site)

## region pricing digests
- [launchintel] Eliza Wildflowers Photography | natural-light style | elizawildflowers.mypixieset.com

=== PHOTOGRAPHER: Evie Joy Photography (Evie Felts) | vendor_id=46b51d39-6b8e-45fa-b3f7-f80aff12a495 | bot=bot7 | date=6/2026 ===
# Evie Joy Photography (Evie Felts) (Mancos/Durango) — vendor_id=46b51d39-6b8e-45fa-b3f7-f80aff12a495
site=http://eviejoyphotography.com | google ?★ × ?

## site pricing/package lines
can i still reserve my date before deciding on a package?
Yes, you can still reserve your date with a retainer fee of $1000 (to be applied towards your total).
What can i add on to my package?
Rolls of film exposures $200/ea
Packages of polaroids $50/ea
Additional hours of coverage $800 (day of add on $1000)
Second shooter $200/hr
Yes. We can break up your invoice into as many payments as you need. The retainer fee is due upon booking, and the remainder is due one week before your date. How you break up payments in between reserving your date and the week before is up to you!
Can i customize my package?
If your package included consultation calls, we will get those booked so that I can assist you with what to wear, and what the best location for you would be. Don't worry, I have an extensive list of beautiful locations for you to choose from.
book a call Wedding & Elopement photography
"Evie did an outstanding job on my elopement..."
My wedding packages are custom-created to fit your specific needs; however they all include:
Highly customized client experience + package curation
Packages starting at $5,200
Packages starting at $2,400
request more info request more info My elopement packages are custom-created to fit your specific needs; however they all include:
Access to my exclusive SWCO Location Guide, Elopement Planning Guide, and LGBTQ+ Affirming Vendor Guide
If your package included consultation calls for what to wear, where to shoot, etc. we’ll set those up right after you sign your contract.

## region pricing digests
- [launchintel] Evie Joy Photography (Evie Felts) | $3,000 starting per WPJA; wedding and elopement photographer based Durango/Telluride area, Southwest Colorado; 5 years experience, former Spanish teacher; backcountry/off-the-beaten-path venue specialty | http://eviejoyphotography.com

=== PHOTOGRAPHER: Hughes Photo Co. | vendor_id=ac89a901-ec7a-474f-9e91-5b7e03a7dde7 | bot=bot8 | date=9/2025 ===
# Hughes Photo Co. (Colorado Springs) — vendor_id=ac89a901-ec7a-474f-9e91-5b7e03a7dde7
site=https://hughesphoto.co | instagram=@hughesphoto.co | google ?★ × ?

## site pricing/package lines
Investment | Book Your Dream Wedding Now &mdash; Hughes Weddings
Wedding Photography Collections
Wedding collections begin at $6,500 and are designed for couples who care about beautiful imagery, a professional experience, and coverage that goes beyond the wedding day itself.
Every collection includes rehearsal coverage , allowing your story to be documented more completely and helping you feel more comfortable before the wedding day arrives.
Because no two celebrations are the same, we’ll help you choose the collection that best fits your priorities, timeline, and vision.
Wedding collections begin at $6000
Rehearsal coverage included in every package

## region pricing digests
- [launchintel] Hughes Photo Co. | High-fashion editorial style | https://hughesphoto.co

=== PHOTOGRAPHER: In Love and Adventure | vendor_id=9fcbf989-ea15-4503-a599-f568850ff1e8 | bot=bot9 | date=8/2025 ===
# In Love and Adventure (Colorado Springs) — vendor_id=9fcbf989-ea15-4503-a599-f568850ff1e8
site=https://inloveandadventure.com | instagram=@inloveandadventure | google ?★ × ?

## site pricing/package lines
Elopement Packages & Pricing | Elope to Colorado or Utah with ILA
Elopement Packages &#038; Pricing
Elopement Packages & Pricing
Colorado Elopement Photographers
An adventure elopement photographer ?
Hey, I’m Kelly, that fun person you invite to your wedding who knows how to snap memories and find the best spots for the view, a.k.a. your Utah or Colorado elopement photographer .
My husband and I eloped 7 years ago and had so much fun. Best part? We didn’t have to dance in front of people or find “unique” wedding ideas on Pinterest . We were able to be fully present with each other, having the day we dreamed of. That’s how I figured out I wanted to photograph elopements !
Now 120+ elopements later, it’s still so exciting to scout locations, figure out a timeline, snap and edit your photos, and yes, even figure out the legal stuff.
I am based out of Grand Junction , Colorado. I work all over Colorado, and Moab , Utah. I&#8217;d love to help you plan and photograph your elopement in the mountains, or the desert.
that means my elopement packages aren’t ever one-size-fits-all.
Adventure Elopement Photography — real-life storytelling, epic backdrops, and happy tears included
My Elopement Packages Include:
complimentary album design
In Love & Adventure Elopement Packages & Pricing
The Ultimate Elopement Package
for the couple who wants it all, the ultimate elopement package includes 12 hours of photography coverage, with the option to split your photo coverage between two days, or a mid day break within one day.

## region pricing digests
- [launchintel] In Love and Adventure | Nature-inspired storytelling; elopement photography, helps plan the elopement then photographs it, mountain/desert focus | https://inloveandadventure.com

=== PHOTOGRAPHER: John Bosley Photography | vendor_id=06f51586-a3ab-4c16-9427-1f3a48e7509e | bot=bot10 | date=12/2025 ===
# John Bosley Photography (?) — vendor_id=06f51586-a3ab-4c16-9427-1f3a48e7509e
site=https://johnbosleyphotography.com | google ?★ × ?

## site pricing/package lines
What is included in your different wedding photography packages? All of my packages include an engagement session, day-of coverage, an online gallery of digital images and printing rights. Options for some packages also include a 2nd photographer and/or wedding album.
Do you require a deposit? I do! In order to book your wedding date, I need a 25% deposit up front. As for paying off the balance, I&#8217;m really flexible. As long as it&#8217;s paid in full by your wedding day, we&#8217;re good!
Do you do engagement sessions? I do and I love them! I also think they&#8217;re really important. Not only do they give us a chance to get to know each other before your wedding day, but they also give you a chance to spend a little time getting comfortable in front of the camera.
Wedding Pricing Toggle navigation
Each year I photograph a limited number of weddings. This allows me to pour all of my energy and creativity into every single wedding I photograph. Wedding photography packages start at $2800. All packages include an engagement session.
For more information on package options and pricing, please contact me . Looking forward to hearing from you!
If you&#8217;re almost there but need some pricing info, I&#8217;ve got it for you right here .
2015 Favorite Engagement Session Photos
There were so many of my wonderful couples I photographed this year who commented on how glad they were that they decided to do an engagement session. I can&#8217;t tell you how happy I am when couples want to do one! Not only do they have a chance to get comfortable in front of the &hellip;

=== PHOTOGRAPHER: Kate Ivy Photography | vendor_id=2aa9db5b-a96c-4970-bbe7-2d33ed3556fe | bot=bot11 | date=4/2025 ===
# Kate Ivy Photography (Denver) — vendor_id=2aa9db5b-a96c-4970-bbe7-2d33ed3556fe
site=https://www.kateivyphotography.com | instagram=@kateivyphotography | google ?★ × ?

## site pricing/package lines
Yes! Film can be added to any package and is included in the elopement package.
Unfortunately, I only offer photography! But I work with some amazing videographers - you can hire them through me for a seamless package that includes both or I can share my vendor list and you can hire them separately.
Based in Denver, Kate Ivy Photography is led by a pair of Colorado wedding photographers who specialize in elopements, micro weddings, engagements, adventure sessions, and lifestyle photography across the Colorado Rockies and destinations worldwide.
Wedding & Elopement Packages in Colorado | Kate Ivy Photography | Kate Ivy Photography
2026 Wedding & Elopement Packages in Colorado
Explore our lifestyle, wedding, and elopement packages in Colorado below. Looking for something different? Inquire about a custom package built just for you!
ALL COLLECTIONS INCLUDE :
Up to 9 hours of coverage day of
One-hour Engagement Session or Adventure Session
(does not include travel fees outside of an hour and a half of Denver)
Up to 8 hours of coverage on the day of
One-hour engagement Session OR rehearsal dinner coverage
Up to 6 hours of Coverage
Up to 4 hours of coverage
Travel fees not included - but willing to go ANYWHERE!
Travel fees may apply for weddings, elopements, and engagement sessions that are further than an hour and a half from Denver. Inquire here for a custom quote. Check out a recent wedding shot in Valle de Guadalupe, Mexico.
Engagement Session $950
This includes rights to at least 75 high res, edited photos. Gallery to share. Travel fees may apply to locations and hour and a half outside of Denver. Session lasts up to 1.5 hours. Photos delivered within 2 weeks. Ask me about my favorite locations.

## region pricing digests
- [kateivyphotography] Kate Ivy Photography | Full-day wedding packages $4,500-$7,200, minimum 8 hours coverage | Denver-based; sneak peeks within days, online gallery, often dual photographer coverage; some packages include weekend coverage, engagement sessions, album credits
- [launchintel] Kate Ivy Photography | Full-day wedding packages $4,500-$7,200; 8 hours of coverage with engagement sessions, online galleries, optional album credits; also offers elopements, micro weddings, engagements, adventure sessions, lifestyle photography | https://www.kateivyphotography.com

=== PHOTOGRAPHER: Kate Merrill Photography | vendor_id=52cd4a91-40b0-400d-b2fd-9a42d143803a | bot=bot12 | date=3/2025 ===
# Kate Merrill Photography (?) — vendor_id=52cd4a91-40b0-400d-b2fd-9a42d143803a
site=https://katemerrillphoto.com | instagram=@roamingnrome | google ?★ × ?

## site pricing/package lines
Cost Peak Season Rates (May-Oct)
Off Season Rates (Nov-Apr)
Peak Season Rates (May-Oct)
Friday &#8211; $7,500
Saturday &#8211; $9,000
Sunday &#8211; $6,500
Mon &#8211; Thurs &#8211; $5,500
Friday & Saturday &#8211; $5,000
Sunday &#8211; $4,250
Mon &#8211; Thurs &#8211; $4,000
** partial venue rates are also available **
Half to Full Day rental options
full transparent pricing
Boulder Elopement Guide
Denver Elopement and Microwedding Guide
Pricing | Kate Merrill Photo
wedding photography pricing
A discount on your engagement session
See that list up there and wonder what all each section covers? Here&#8217;s a breakdown for ya! We&#8217;re building a package together in a totally unique way, and I don&#8217;t expect you to know all these terms off the bat.
Adds a second photographer for the important parts of the day. Their time will overlap with mine, and I will figure out when they are needed to get you the best images!!
Do I need a second photographer?
This is one of the most common questions I get asked when folks are building their packages, and here are my usual rules. You don&#8217;t need a second photographer if&#8230;
You do need a second photographer if&#8230;
These rules are not hard and fast, but are a good starting place when you are making the decision to include a second photographer in your wedding package! I&#8217;m always happy to talk through your options here in more detail too. Don&#8217;t hesitate to reach out!
Do you offer standalone engagement sessions?
What is your elopement pricing?
pdf rate cards seen on site (not fetched): https://blancdenver.com/bd/wp-content/uploads/2024/01/blanc-Policies-2024-2025.pdf

## region pricing digests
- [launchintel] Kate Merrill Photography | efficient elopement shoots, lots of shots in two hours; rate under $3k | katemerrillphoto.com
- [launchintel] Kate Merrill Photography | Creative storytelling; also seen on WPJA at $1,800 starting price | https://katemerrillphoto.com

=== PHOTOGRAPHER: Kelly Miller Studios | vendor_id=9df3e9ce-ce95-4063-8db5-689f057b594f | bot=bot13 | date=5/2025 ===
# Kelly Miller Studios (?) — vendor_id=9df3e9ce-ce95-4063-8db5-689f057b594f
site=https://kellymillerstudios.com | google ?★ × ?

## site pricing/package lines
blog home about ELOPEMENTS & INTIMATE WEDDINGS BOUDOIR SUPER 8 & VIDEOGRAPHY PORTRAITS & ENGAGEMENTS Wedding PHOTOGRAPHY
Elopement photography Videography
+ Second Photographer
+ Engagement Session
Packages RANGING FROM $5500-$12K
AVerage investment for a 8hr wedding is $8K
+ 6 Hours to Full Day Coverage
Inquire for a quote based on your event, hourly options available for a custom quote.
Yes, I'm documenting destination weddings and elopements throughout the year. Although I'm based in the mountain west, I'm experienced in many destinations across the United States and internationally. Inquire about my travel schedule if you'd like to take advantage of local rates.
Portrait sessions required a 50% retainer to confirm your session, while weddings and events have a variable retainer based on package. I offer a payment plan option and payment is handled through a secure portal online when you sign your booking contract.
Wedding videography can be booked as a standalone service or as a package with photography.
A standalone, or packaged service.
Ranging from $4000 - $8500
Average investment $5500
+ Half - Full Day Coverage
+ Travel fees complimentary
Custom quotes STARTING AT $4500
DIGITAL, FILM, AND SUPER 8 FOR YOUR WEDDING + ELOPEMENT
Weddings & Elopements
Elopement and downtown reception
I am a wedding and elopement photographer and Super 8 filmmaker.
& Elopement Photography
Packages or custom collections to create a unique experience for each client.
WEDDING & ELOPEMENTS
Started with a Rocky Mountain Elopement

=== PHOTOGRAPHER: Kins Photography | vendor_id=c939a2ee-6fa5-422b-b1e9-84cc391d7e7a | bot=bot14 | date=3/2025 ===
# Kins Photography (?) — vendor_id=c939a2ee-6fa5-422b-b1e9-84cc391d7e7a
site=https://kinsphotography.com | instagram=@kinhk1991 | google ?★ × ?

## site pricing/package lines
Wedding Photographer Services Price | Kin Photography
Elopement Photography
Wedding Photography Pricing
Your wedding is a once-in-a-lifetime event and you would want to find a reliable photographer, whether they charge low or high rates. I've heard many horror stories of photographers delivering subpar images or taking payment without providing any services.
Elopement / Wedding Photography Pricing in Bay Area, CA
Inquire to Customize package for Multi-day wedding and/or Destination Wedding
&hearts;︎ Full day coverage
Signature Collection
*Kindly note that these rates represent a discount for consenting to the use of your photos in our social media and website promotions. A non-usage fee is available upon request the client.
*PRICES ARE INCLUSIVE OF TAXES
ALL PACKAGES COME WITH A 30-DAY TURNAROUND GUARANTEE
We finalize the plan and begin the booking process. I will send you the invoice and contract for your before you make the deposit. The date is confirmed once the deposit is received!
​A Private online album will be provided.
Photography package preferred (Required)
Half Day (up to 5hrs)
Full Day (up to 12hr)
San Francisco California Engagement Elopement Photography
Overwhelmed by the chaos of traditional weddings? Elopement may be the perfect way to privately celebrate with your loved ones.
Whether you choose to elope in the stunning nature of California or venture out into Sahara Desert in Morocco, I'm here to capture the authenticity and magic of your elopement in these unforgettable locations.

## region pricing digests
- [launchintel] Kins Photography | full day price $3000 for Colorado, no call needed for pricing | kinsphotography.com

=== PHOTOGRAPHER: Kokoro Photography | vendor_id=ad6f9205-79e3-4737-99ac-c5b4274efa7d | bot=bot15 | date=10/2025 ===
# Kokoro Photography (?) — vendor_id=ad6f9205-79e3-4737-99ac-c5b4274efa7d
site=https://kokorophotography.com | google ?★ × ?

## site pricing/package lines
(none found on site)

=== PHOTOGRAPHER: Liam Gordon Photography | vendor_id=02f90bc5-30cf-464d-b1b4-4fe804624d11 | bot=bot16 | date=5/2026 ===
# Liam Gordon Photography (Colorado Springs) — vendor_id=02f90bc5-30cf-464d-b1b4-4fe804624d11
site=https://liamgordon.photography | instagram=@liamgordon.photo | google ?★ × ?

## site pricing/package lines
Moss Denver wedding pricing - $3,500 (Mon-Thurs) - $9,000 (prime Saturday).
Garden of the Gods Engagement Session
I will send you a project proposal with the package we discussed, along with a contract that you can sign online and pay the retainer. Then congrats! You’ve got your photographer booked!
Packages start at $4800.

## region pricing digests
- [launchintel] Liam Gordon Photography | $5,000 starting; hands-off documentary/candid style, serves all of Colorado; WPJA top international photographer; almost fully booked for 2026 | https://liamgordon.photography

=== PHOTOGRAPHER: Love Stories with Jen | vendor_id=a8f204c4-d7f2-465b-ab3e-f15ad03cdaf3 | bot=bot17 | date=2/2025 ===
# Love Stories with Jen (?) — vendor_id=a8f204c4-d7f2-465b-ab3e-f15ad03cdaf3
site=https://lovestorieswithjen.com | google ?★ × ?

## site pricing/package lines
Investment | Love Stories With Jen
Once we’ve decided we’re a great fit, it's time to make it official! I require a 30% deposit at the time of signing the contract that will need to be completed in 48 hours or your wedding date becomes available to other inquiring couples.
Out of state Elopements
Investment starts at $2250 for 2 hours
Investment starts at $4200 for 4 hours
Investment starts at $4000 and 5 hours of coverage
Investment starts at $5000 and 5 hours of coverage
In state elopements (Colorado & Arkansas)
Investment starting at $750
"She went above and beyond and the result was priceless keepsakes that our family will treasure for a lifetime."
"Jen was the best investment we made for our wedding."
Blog Contact investment About Home
wedding, elopement, and couples photographer
I’m a Colorado Film photographer specializing in wedding, elopement, and couples photography with a love for telling honest, heartfelt stories through both digital and 35mm film photography.
your Colorado film wedding and elopement photographer.

## region pricing digests
- [launchintel] Love Stories with Jen | cinematic/moody style | lovestorieswithjen.com

=== PHOTOGRAPHER: McKenzie Bigliazzi Photography | vendor_id=5cd51876-c690-4d09-8f20-f83e2782ab27 | bot=bot1 | date=11/2025 ===
# McKenzie Bigliazzi Photography (Denver) — vendor_id=5cd51876-c690-4d09-8f20-f83e2782ab27
site=https://mckenziebigliazzi.com | instagram=@mckenzie_bigliazzi | google ?★ × ?

## site pricing/package lines
Home About Wedding Pricing Blog contact
Here to help badass couples stay present on their elopement day through custom planning services & story-telling imagery.
Hiring your dream photographer is just one piece of the puzzle for your elopement or wedding.
I have couples that decide to do a totally DIY elopement, which is so badass and something I just wouldn’t have the patience for. The majority of my couples are hiring at least two to three other vendors to create their perfect Colorado wedding day.
As you’re planning your elopement or wedding, check out this list of a few of my favorite allied wedding vendors in Colorado!
A pre- or post-elopement picnic is one of my favorite things, whether you’re inhaling a cupcake or munching on a charcuterie board. This list also includes some businesses that can whip up a special dinner for you and bae.
Hiring a private musician is such a special touch. It could be for the first dance at your elopement or as entertainment to enjoy at an intimate wedding.
Wedding Pricing About Kenzie Home
Brand Pricing Podcast
Wedding Pricing BLOG Allied Vendor Guide
Colorado Wedding & Elopement Packages | McKenzie Bigliazzi
Colorado Wedding & Elopement Packages
Get access to a meeting link and packages within 48 hours
ELOPEMENTS Courthouse Engagements Weddings BOOK it →
Average investment $7750
ELOPEMENTS Courthouse
ELOPEMENTS Courthouse Engagements Weddings Click here for the Full courthouse guide BOOK it →
ELOPEMENTS Courthouse Engagements Weddings
To Book, 40% of your package is due up front. The remaining can be paid in flexible payment plans.

## region pricing digests
- [launchintel] McKenzie Bigliazzi Photography | Alternative documentary style | https://mckenziebigliazzi.com

=== PHOTOGRAPHER: Molly Margaret Photography | vendor_id=bc9a65b4-fd19-415f-8bad-6afcafa82465 | bot=bot2 | date=10/2025 ===
# Molly Margaret Photography (?) — vendor_id=bc9a65b4-fd19-415f-8bad-6afcafa82465
site=https://mollymargaretphotography.com | google ?★ × ?

## site pricing/package lines
Weddings + Elopements
I do and I love capturing my clients family photos! It’s a limited weekday only schedule but feel free to check out my pricing here, and my portfolio here. These sessions are also available as digital or film and digital combination.
Yes! I recommend either printing directly through your album that I send you (pixieset), mpix, or Artifact Uprising use MOLLYMARGARET15 for 15% off.
Colorado Weddings, Elopements and Engagements
PRICING + INFORMATION GUIDE
It’s that easy, really! Email me or fill out my contact form. From there I reach out and we review any initial questions you have an budget/package options.
I’ll send over a digital contract and invoice which includes all the details we went over regarding your wedding date, hours of coverage and what type of coverage you’d like. Once you sign and issue your initial payment - you’ll be booked!
Pricing doesn’t have to be some big secret , I lay it all out here for you. Everything is customizable - looking for more or less coverage? Let me know when you inquire and I can always create a personalized package for you.
Colorado Photography and Videography Pricing
All Packages include personal use rights, phone call consultations with me as needed (or email if that’s more your style!) assistance with timeline suggestions, trusted vendor recommendations, and creative guidance.
All pricing includes travel within 100 miles of the Denver, Colorado area. During winter months there may be additional travel fees to mountain areas. I do not offer drone coverage with any of my services at this time. Prices subject to change without notice.

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-16.csv
