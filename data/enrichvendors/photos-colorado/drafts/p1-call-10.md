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


=== PHOTOGRAPHER: Madeline J Studios | vendor_id=c444968d-f8c8-436d-b0de-df8222bd666b | bot=bot17 | date=3/2026 ===
# Madeline J Studios (Denver) — vendor_id=c444968d-f8c8-436d-b0de-df8222bd666b
site=http://www.madelinejstudios.com/ | instagram=@madelinejstudios | google 4.9★ × 86

## site pricing/package lines
Travel fees fully included in your custom quote
Travel fees included (FULLY included in your official quote!)
1 hour coverage per location, 2 outfits per hour
Up to 2 outfits per hour
This collection is offered M-Th
I customize each and every package to fit your exact need! Let’s chat about your event and I’ll give you a custom proposal.
She has a really amazing eye for capturing those candid moments at a wedding and will deliver the sweetest photos that you didn’t even think to ask for. Going through our wedding album, I can’t decide which to pick because they’re all stunning!

## google reviews (top 3)
- (5★ 2025-11) Maddy is an INCREDIBLE photographer. She photographed our wedding in June. She was an absolute joy to work with throughout the planning process, and really helped make sure our day went smoothly. She was consistently communicative and helpful. Even though we had never done a wedding before, it was incredibly helpful to have her, a wedding veteran and true professional, by our side. We also felt li
- (5★ 2025-09) Maddy is such a talented photographer, she spent our wedding day with us and her photos are absolutely stunning. For posed photos, she knew exactly where and how to set us up, and the candid photos she got of us, our friends, and family are perfect. I don’t know how she was able to catch all of these fleeting moments the exact second they were taking place. As a person, she is an absolute joy. You
- (5★ 2025-11) Maddy photographed my wedding last weekend. I have still only seen sneak peaks and I KNOW she slayed the rest. (The sneak peeks are a 10/10). Maddy did an amazing job keeping everyone on track for photos and honestly just keeping my whole night on track. She was more than just a photographer to me she was such a support. She helped me with my bustle and so much more. Do not walk, run to booking he

## region pricing digests
- [launchintel] Madeline J Studios | Documentary photojournalism style; 9+ years experience, willing to travel | https://www.madelinejstudios.com

=== PHOTOGRAPHER: Magnified Joy Photography | vendor_id=6451f7a2-eb8e-4a19-8cb0-07f6e8819c6c | bot=bot1 | date=10/2025 ===
# Magnified Joy Photography (Crested Butte) — vendor_id=6451f7a2-eb8e-4a19-8cb0-07f6e8819c6c
site=https://www.magnifiedjoy.com/ | google 5★ × 6

## site pricing/package lines
We think your marriage is more important than your wedding. That’s why we seek to build a relationship starting at your engagement. We want to laugh, cry, celebrate, and encourage all throughout the moments we will share together.
Kristin + Phil&#8217;s intimate elopement in front of a waterfall during wildflower season in Crested Butte
You say engagement session, we say adventure session

## google reviews (top 3)
- (5★ 2020-02) In August 2019, our community of Family & Friends came together in the mountains of Crested Butte, Colorado, for our oldest Daughter, and now Son in Law's, incredible WedFest Event! There with us, were En Tao and Maria Ko, of Magnified Joy....! From the moment I spoke with En Tao on the phone, (me in Austin, him in Denver at the time), there was an instant connection, and, I knew there was no need
- (5★ 2019-11) This review is much overdue. En Tao and Maria went above and beyond for our wedding last fall. They took the initiative to get to know us beforehand (they took us out for tacos and walked us through a little practice shoot) so we were totally comfortable with them on our wedding day. We hired these two because we loved how natural their photos look - not staged - and they managed to accomplish thi
- (5★ 2019-07) En Tao & Maria did a fabulous job photographing our mountaintop wedding in gorgeous Crested Butte! They have a unique way of showcasing the stunning landscapes while still capturing the intimate moments of the wedding itself. Their fun & laid back personalities made us all feel comfortable throughout the day. Their prompt & professional manner both before and after the big day meant no photography

=== PHOTOGRAPHER: Mallory Munson Photography | vendor_id=6ee0beb7-af1a-4993-b70a-d40de1b5580e | bot=bot2 | date=7/2025 ===
# Mallory Munson Photography (Denver) — vendor_id=6ee0beb7-af1a-4993-b70a-d40de1b5580e
site=http://mallorymunson.com/ | instagram=@mallorymunsonphotography | google 5★ × 94

## site pricing/package lines
I specialize in engagements, weddings and elopements in Denver, Colorado and around the world. I make no excuses to enjoy my life. Living half the year in Bali, dancing at all opportunities and solo traveling often.
all collections include
All collections include Mallory as your lead photographer with an option to add a second photographer, rehearsal coverage and custom album.
Engagement sessions are 1.5 hours in length and are best at sunrise or sunset. Some couples prefer to do a session for save the dates or to get a feel in front of the camera.

## google reviews (top 3)
- (5★ 2024-09) Mallory’s photo style is timeless, fun, colorful, and surprisingly hard to find from other wedding photographers. When I came across her Instagram for the first time, her photos were exactly what I was looking for, and I was elated when she promptly replied to my inquiry that she was available for my wedding date! Her option for payment installments was very helpful during the wedding planning pro
- (5★ 2025-10) As wedding venue owners ourselves, we’ve worked with so many talented photographers — but Mallory and Nora with Mallory Munson Photography are truly something special. We own Pikes Peak Ranch, and when it came time for our own wedding, there was no question who we wanted to capture it. They exceeded every expectation and then some. Our day brought every kind of Colorado weather imaginable — sunshi
- (5★ 2024-07) Mallory Munson is incredible! We were her first wedding of the season, and even though she was jet lagged, she got up at the crack of dawn to photograph our elopement, and showed up with a smile and laughs! It felt like I'd known her for years. She made myself and my husband feel so comfortable, even though we're both typically nervous in front of a camera. She had so many ideas about the best sho

## region pricing digests
- [launchintel] Mallory Munson Photography | also destination

=== PHOTOGRAPHER: Mark Creery Photography | vendor_id=d318dc6f-8c2c-46c4-9bb4-87dcc62a8684 | bot=bot3 | date=1/2026 ===
# Mark Creery Photography (Fort Collins) — vendor_id=d318dc6f-8c2c-46c4-9bb4-87dcc62a8684
site=https://www.markcreeryphotography.com/ | google 5★ × 112

## site pricing/package lines
Colorado Wedding Photographer - Mark Creery Photography Weddings Engagements Portraits Packages About Reviews Info Contact
Best Photos Panoramas Album designs
wedding album care What to wear for your engagement session Wedding gown shopping
What to Expect Engagement session Wedding albums Wedding Photography Guide Tips Estes Park wedding photographers
Weddings Engagements Packages About Reviews Info Contact

## google reviews (top 3)
- (5★ 2018-07) We really enjoyed working with Mark, he was a comfortable presence to have around and our photos turned out beautifully. I think he did an excellent job of telling the story of our wedding, and I loved looking through the gallery and getting to re-live that very special day and experience all of the emotions running through our guests as well. We have received SO MANY compliments on our beautiful 
- (5★ 2023-05) Mark surpassed all our expectations with his remarkable work on both our engagement and wedding photos! From the very beginning, his communication and responsiveness were truly outstanding, making the entire wedding planning process smooth and stress-free. On our special day, Mark's talent and expertise truly shone through as he effortlessly captured every single precious moment. We were amazed to
- (5★ 2024-10) Long story short: Book with Mark—you won’t regret it! He’s incredibly easy to work with, always understanding, and adapts seamlessly to whatever scenery or vibe you’re aiming for. Neither my husband nor I are models, but Mark made us feel completely comfortable in front of the camera. His talent for capturing natural, beautiful moments shines through in his editing—everything looked polished witho

## region pricing digests
- [launchintel] Mark Creery Photography | Starting at $3,200-$3,500; 20 years experience; 110+ 5-star Google reviews, 11x award winner; candid moments telling the wedding day story; serves Fort Collins, Estes Park, Denver, Boulder, Breckenridge, Longmont and beyond | https://www.markcreeryphotography.com

=== PHOTOGRAPHER: Marry Me In Colorado | vendor_id=33ac5f88-3d98-4648-9fcc-e800df9a9f9d | bot=bot4 | date=3/2026 ===
# Marry Me In Colorado (Estes Park) — vendor_id=33ac5f88-3d98-4648-9fcc-e800df9a9f9d
site=http://www.marrymeincolorado.com/ | google 4.1★ × 81

## site pricing/package lines
Since COVID, There have been many companies start offering elopement services. What sets Marry Me In Colorado apart from the others?
We are also happy to travel outside of the Estes Park and Rocky Mountain National Park areas. There is no travel fee within 30 minutes of travel from Estes Park, but travel fees do apply for sites outside of this area.
We love the packages but have more guests than they mention. Can we have additional guests?
2. Marriage License - Your license is up to you to obtain prior to your wedding and is only $30.
4. Package Add-Ons - Interested in extra photos, a bigger cake, or fresh flowers? These are all optional fees based on your personal preferences and needs to make your day perfect!
We love the idea of an all-inclusive package, but we are sort of in-between several of your options. Do we have the ability to customize a package?
Marry Me In Colorado - Elopements and Micro Weddings in Estes Park and Rocky Mountain National Park - All-Inclusive Elopement and Intimate Wedding Packages, All-Inclusive Elopement and Intimate Wedding Packages, Elopement Packages, Wedding Service
All-Inclusive Elopement and Intimate Wedding Packages
Traditional Elopement
The Last Minute Elopement
For those planning a last minute elopement booked within 30 days of your date. Up to 4 guests
The Traditional Elopement, Last Minute and Bella Packages Include MMIC&#x27;s Basic Wedding Planning Concierge Service - Recommendations for lodging, dining, etc.
* Additional Guests $20/Ea
SAVE $300 on the Amore Package!

## google reviews (top 3)
- (4★ 2024-06) You never know what to expect for an elopement but boy was this fun! Kevin was a pleasure to work with as our officiant and Kennedy was a breath of fresh air as our photographer. Our day started off with a landslide on the road to Estes Park so a detour was in our future which was going to delay our arrival in RMNP. Kevin was on it as his sunrise wedding was also late arriving which pushed us back
- (5★ 2022-02) We used Marry Me In Colorado for our small family wedding ceremony and reception in Estes Park. Since we were coming in from out of town, we had a lot of questions about ceremony location, and Kevin was helpful in getting everything sorted out for us. In fact, we ultimately changed the planned ceremony location the day of due to 40+mph winds from outside to indoors, and the Marry Me team was super
- (5★ 2026-01) Highly recommend marry me in Colorado! Kevin and his team worked with us very hands on and made the wedding feel completely comfortable and an easy process! They talked us through everything and it was truly perfect! Kennedy was a great photographer as well she really made us feel like we got all the best shots and made taking photos easy and comfortable! Would highly recommend them to anyone gett

=== PHOTOGRAPHER: Matt Alberts Photography | vendor_id=bb9aab05-470d-4673-9090-d86f9a0f6eed | bot=bot5 | date=11/2025 ===
# Matt Alberts Photography (Vail) — vendor_id=bb9aab05-470d-4673-9090-d86f9a0f6eed
site=http://www.mattalbertsphotography.com/ | google ?★ × ?

## site pricing/package lines
A Rocky Mountain Love Affair: A Stylish Elopement Atop Montezuma Peak

=== PHOTOGRAPHER: Michael Morse Wedding Photography | vendor_id=d1b06bf9-9d2c-4a8c-93f3-c4b3fa28fc87 | bot=bot6 | date=12/2025 ===
# Michael Morse Wedding Photography (Telluride) — vendor_id=d1b06bf9-9d2c-4a8c-93f3-c4b3fa28fc87
site=https://www.mikemorsephotography.com/ | google 5★ × 84

## site pricing/package lines
Home - Michael Morse Elopement and Wedding Photography
WEDDING &#038; ELOPEMENT PHOTOGRAPHY
International Adventure Elopements
Packages &#038; Pricing
Elopement Experiences
Twenty Years of wedding and elopement experiance
Telluride elopement experiences
Pacific Northwest adventure elopement
Tofino Elopement with Atleo River Air
YOSEMITE WEDDING AND ELOPEMENT PHOTOGRAPHER
Are you planning a wedding or elopement?
Dunton Hot Springs Wedding and Elopement Photographer

## google reviews (top 3)
- (5★ 2025-04) It is nearly impossible to narrow down 1,000 great photos into a handful of examples to illustrate Michael's ability to capture special moments - but if you've been to his website, you've already seen how creative and adventurous he is with his photography! My husband and I interviewed several photographers and chose Michael because we got the sense that he was going to be able to flow with us and
- (5★ 2024-08) My husband, Dan, and I had an amazing time working with Michael. Michael took our engagement photos in Telluride during early July of 2023, and he also photographed our wedding at Granby Ranch in late June of 2024. Michael's photography captured both the beauty of our mountain setting while also showcasing the emotion and connection between us as a couple. I was so impressed by his work. When we r
- (5★ 2025-05) We had an amazing time working with Michael! He was recommended by our lovely wedding planners after they heard how important the photos were to us and it was the best decision! Michael captured our Crested Butte micro-wedding perfectly even with all the weather (hail, rain, and shine) that CO had to offer. The wildflowers were blooming and Michael knew all the best spots to capture the amazing sc

=== PHOTOGRAPHER: Michael Rawlings Photography | vendor_id=6008e4b8-2058-44f3-8821-d9b50edac159 | bot=bot7 | date=12/2025 ===
# Michael Rawlings Photography (Eagle) — vendor_id=6008e4b8-2058-44f3-8821-d9b50edac159
site=http://www.vailphotography.com/ | google 4.9★ × 71

## site pricing/package lines
Elopement in Vail and Beaver Creek
In addition, my wife is an experienced wedding officiant so I often package the two of us together. I discount both of our services and help you remove an important item from your to-do list. Please give me a call to discuss your needs and preferences, so I can give you accurate, detailed pricing.
Unlimited consultations are free of charge to discuss everything from your preferences for photography to the wedding day schedule and image selection for your wedding album.

## google reviews (top 3)
- (5★ 2020-05) What a fantastic guy! And what a memorable experience. Last Spring, my wife surprised me with a "Photo Safari" with Michael while our family visited Vail. Michael picked me up early in the morning from our rental house and we drove to Sylvan Lake for a sunrise photo tour. I'm a hobby landscape photographer, so I already have a basic working knowledge of my camera. But what Michael taught me that m
- (5★ 2026-01) I reached out to Michael from North Carolina about engagement photos and had absolutely no idea where to start. Being out of town, I didn’t know locations, timing, or how to plan any of it. Michael handled everything. He drove all the way to Beaver Creek, scouted locations in person, FaceTimed me while walking the area, and helped plan every detail so the proposal went perfectly. He completely too
- (5★ 2024-05) Michael did an amazing job shooting our engagement in February. My fiancé and his Aunt had been in touch with Michael prior to my surprise proposal. They said he was wonderful at communicating with them and helped ease their stress of capturing such a special moment. Fast forward to the proposal, Michael did such a great job at capturing every single moment. He was SO easy to work with and very pe

=== PHOTOGRAPHER: Michele Schanker Photography {Breckenridge Photographer} | vendor_id=982e82bb-7608-4744-80c1-be3e05976b05 | bot=bot8 | date=7/2025 ===
# Michele Schanker Photography {Breckenridge Photographer} (Breckenridge) — vendor_id=982e82bb-7608-4744-80c1-be3e05976b05
site=http://www.micheleschankerphotography.com/ | google 5★ × 45

## site pricing/package lines
I have lists I have complied for Winter and Summer sessions. I am an on location photographer and do not shoot at rental houses. Sorry if this is disappointing, but I have several reasons as to why I don't shoot at rentals. The exception I will make for that is elopements.
Do you charge a deposit to reserve a session?
Yes. I do a 25% deposit to reserve the day and time you are requesting.
Is the deposit refundable?
Do I have to choose which package I want before my session?
No you do not! You can wait until you see your gallery to decide which package you would like to do. If you decide you would just want a few extra images that is fine too. I am pretty flexible.
I see that you offer a package with an album, if there a reason why I should order the album instead of printing my own book?
My albums/books are ordered from a professional photolab. Therefore the quality is much better then shuterfly, blurb. etc....
Weekend Surcharge:  There is  a surchage for sessions on a Saturday or Sunday. This extra chage is $50 for weekend sessions. At this point in time there is not an extra charge for Friday sessions.
1. 30 minute session with 10 digital images is $350
2. 30 minute session with 20 digital images is $525
3. 30 minute session with the entire gallery is $740
1. 1 hour session with 20 digital images is $550
2. 1 hour session with 40 digital images is $730
3. 1 hour session with the entire gallery is $900
4. 1 hour session with the entire gallery and a 20 page layflat album $1100.
Cost will be $185 and include 5 digital images with a print release.

## google reviews (top 3)
- (5★ 2025-10) Michele was fantastic. She found a beautiful location for our daughter's senior photographs, a mountain lake that captured her love of the outdoors and trail running. Michele was very efficient and very firendly, getting a large number of photos and helping our daughter to pose naturally against the amazing landscape. The final photos are wonderful and will be used for much more than just a senior
- (5★ 2025-12) We had a large family session (11 people) this summer with Michele while we were there on vacation. She was fantastic. She took all the different groups we wanted and was so easy to work with. She had many locations to choose from, which was nice. The pictures turned out great and her prices were very reasonable, especially for the area. If you need photos in the Breckenridge area, book Michele!
- (5★ 2024-06) We booked a session with Michele for our large group of extended family members. She did a great job capturing all of our different groupings, working with our young kids, and having great pose suggestions. Our pictures turned out great!

=== PHOTOGRAPHER: Michelle Betz Photography | vendor_id=f42c591c-6657-497a-a081-300a39e4f8b1 | bot=bot9 | date=2/2025 ===
# Michelle Betz Photography (Colorado Springs) — vendor_id=f42c591c-6657-497a-a081-300a39e4f8b1
site=https://michellebetzphotography.com/ | google 5★ × 34

## site pricing/package lines
Contact BLOG Engagement family Weddings About Home Elopements
Weddings About Home Elopements
After that, you book your Colorado Springs wedding date with a 25% retainer of the total cost . The rest is due the day before the wedding.
2. Engagement Session
Six hours of coverage: 400+ edited images
Seven hours of coverage: 500+ edited Images
Eight hours of coverage: 600+ edited images
4. Is there a deposit when booking?
(A Second Shooter, and discounted engagement session, and bridal boudoir can be added! )
average investment range $3999 - $6000
weddings from $3,999 for 6 hours
All Colorado Springs Wedding Photography Packages Include:
Wedding Collection Add-ons: Second Shooter,
50% Discounted Engagement Session or 50% Discounted Bridal Boudoir
Colorado Springs Wedding Photography Pricing
Michelle was absolutely amazing during our private elopement!! She went above and beyond to make our special day even more magical!! The pictures were beyond what we could have ever hoped for. 10/10 would recommend!!
WEDDINGS START FROM $3,999
ELOPEMENTS FROM $2,200
Contact BLOG Kind Words family engagement Weddings elopements About Home
Weddings & Elopements & family
Colorado Wedding & Elopement Photographer
Contact BLOG family engagements Weddings About Home Elopements
I’m Michelle—a wife, a mom, and a wedding, elopement, and family photographer based in beautiful Colorado. Photography isn’t just what I do—it's what I love.
Your colorado Wedding & elopement Photographer
hen it comes to your Colorado wedding or elopement, I am here to make sure you have a stress-free and fun filled day!

## google reviews (top 3)
- (5★ 2025-04) I recently had the pleasure of working with Michelle for my wedding, and I can't express how thrilled I am with the results! The photos are absolutely stunning; each one beautifully captures the essence of our special day. From the very beginning, Michelle was incredibly detailed and direct in her approach, ensuring that every moment was planned out perfectly. Her professionalism and clear communi
- (5★ 2025-03) We are absolutely thrilled with the experience we had with Michelle Betz as our wedding photographer! She truly went above and beyond to make sure we got the most breathtaking and memorable pictures from our special day. Every photo is a testament to her incredible talent and attention to detail. Not only is she a gifted photographer, but she is also incredibly sweet and personable, which made the
- (5★ 2024-12) Michelle was such an important piece of our wedding day and the photos she captured will be cherished for a lifetime! She’s incredibly kind, communicates very well, and she is very talented! If you’re searching for a photographer and you’re worried because you want the right kind of person to trust with your day, look no further. Michelle is your girl and she’s amazing. Also, the pricing is very f

=== PHOTOGRAPHER: Mikayla Renee Photo | vendor_id=b8c21c61-c077-496d-9892-85b5d9bf5f54 | bot=bot10 | date=1/2026 ===
# Mikayla Renee Photo (Colorado Springs) — vendor_id=b8c21c61-c077-496d-9892-85b5d9bf5f54
site=https://mikaylareneephoto.com/ | instagram=@mikaylareneephoto | google 5★ × 96

## site pricing/package lines
Colorado Elopement Photography Packages - Colorado Wedding and Elopement Photographer
Colorado Engagement Sessions
Colorado Elopement Photography Packages
Pricing, packages, and information for laidback couples who know they want a more intimate day
WELCOME TO AN ELOPEMENT EXPERIENCE
Scroll below to choose a Colorado elopement photography package to honor your day!
As your  elopement photographer , I’m not here to boss your day around. I’m here to cheer you on, help you include everything that matters, and capture all the moments that feel real.
WHAT IF I TOLD YOU THAT PLANNING YOUR ELOPEMENT&#8230;
Sarah & Justin, San Juans National Forest Elopement
CHOOSE YOUR ELOPEMENT EXPERIENCE
Once we confirm we’re the right fit for each other, we’ll move forward by signing a contract, securing your date with a $2,000 retainer, and starting the planning process together.
If you&#8217;re having a hard time deciding which Colorado elopement photography package is for you, reach out and we can brainstorm together!
Multi-Day Package Includes:
+ 60+ page elopement planning guide
Full Day Package Includes:
Half Days Package Includes:
Mini Package Includes:
The Elopement Inquiry Process & How It Works
ELOPEMENT PLANNING RESOURCES
COLORADO ELOPEMENT GUIDE: THE ULTIMATE GUIDE TO PLANNING YOUR ELOPEMENT
ELOPEMENT TIMELINE INSPO TO HELP PLAN YOUR DAY
ULTIMATE COLORADO SPRINGS ELOPEMENT GUIDE
TELLURIDE ELOPEMENT GUIDE: THE ONLY ONE YOU&#8217;LL EVER NEED
CAN YOU HELP US FIND AN EPIC ELOPEMENT LOCATION?
Yes! I compile a list of elopement locations based on how much hiking/off-roading you want to do and the types of views you love!

## google reviews (top 3)
- (5★ 2024-10) Mikayla was an absolute DREAM to work with, and we are so beyond thrilled with our wedding photos. My partner and I were initially attracted to Mikayla's elopement photography because of the ways she captures couples within a landscape so beautifully. We wanted to exchange vows in private before our bigger wedding, and wanted to have Mikayla guide us and shoot that experience in addition to the we
- (5★ 2025-11) Hiring Mikayla as our photographer for our wedding was the best decision we made! We first worked with her for our engagement shoot and then again for our wedding at San Sophia Overlook. From the first call she was everything you’d hope for in a photographer: creative, adventurous, and full of positive energy. On our engagement shoot, she didn’t hesitate to go the extra mile (literally into chest-
- (5★ 2025-10) Where to even start? Mikayla was wonderful from the moment we reached out to her. She was as excited for our wedding as we were; answering our questions and giving recommendations for vendors. She was super helpful throughout and let me send her a long list of shots that I was hoping for. She was helpful in figuring out timing and also was able to get the amazing shots in a super timely way (we wa

## region pricing digests
- [launchintel] Mikayla Renee Photography | Mikayla
- [launchintel] Mikayla Renee Photo | Classic documentary style | https://mikaylareneephoto.com

=== PHOTOGRAPHER: Moon Myerson Photography | vendor_id=24c7e487-f010-4de4-9d7e-12be7bda8e56 | bot=bot11 | date=7/2025 ===
# Moon Myerson Photography (Fort Collins) — vendor_id=24c7e487-f010-4de4-9d7e-12be7bda8e56
site=https://www.moonmyersonphotography.com/ | google 4.7★ × 12

## site pricing/package lines
Whether you're planning a full wedding day or a portrait session, this FAQ covers everything you need to know&mdash;from how to book to what to expect during your photography experience. You'll find details on Colorado wedding photography, engagement sessions, family portraits, and more.
Can we order prints and albums through you?
My packages include up to 1 hour of travel time from Fort Collins. That covers Estes Park, Loveland, Greeley, Longmont, Louisville, Lafayette, Boulder, and many other Northern Colorado and Front Range locations.
I charge $100/hour for travel beyond that first hour and will travel just about anywhere in Colorado. For locations outside of Colorado, contact me and let's chat.
For travel more than 1 hour from Fort Collins, I charge a prorated $100/hour travel fee.
I require a non-refundable 50% deposit up front in order to reserve your time. The rest of the balance is due after the shoot takes place and before delivery of photos.
Wedding Photography Pricing | Moon Myerson | Fort Collins, CO
Wedding Collections Designed for Your Day
I keep my packages clear and complete, so you can find the right coverage for your day.
The collection for couples who want the most complete version of the day documented, from getting ready through the heart of the reception. A second photographer works alongside me throughout, so the moments happening in two rooms at once never come down to a choice.
A second photographer throughout
Includes a second photographer for complete coverage.

## google reviews (top 3)
- (5★ 2025-09) Moon was delightful to work with. Super easy going and captured everything we asked for and so much more. Our wedding photos came out BEAUTIFUL!!
- (5★ 2025-01) Moon did an incredible job with our outdoor photoshoot at a quarry! The location was stunning, and Moon knew exactly how to use the natural light and scenery to create breathtaking shots. They made us feel so comfortable throughout the session, and their creative ideas brought out the best in every photo. The way they captured the textures of the quarry and the beauty of the surroundings was truly
- (5★ 2025-10) My husband and I booked Moon to take photos for our elopement and we could not be happier! He was extremely kind and helpful from start to finish, helping us figure out the perfect location, and even giving us local recommendations. We were nervous to get good photos because we feel anxious on camera, but he gave us great scenes and poses and the pictures turned out so beautiful. I would highly re

=== PHOTOGRAPHER: Mountain Wedding Garden | vendor_id=71cfefae-6397-443f-9804-0066a3032959 | bot=bot12 | date=5/2025 ===
# Mountain Wedding Garden (Crested Butte) — vendor_id=71cfefae-6397-443f-9804-0066a3032959
site=https://mountainweddinggarden.com/contact/ | google 4.9★ × 50

## site pricing/package lines
Clean up/Damage Deposit
A fifty percent non-refundable deposit is due seven days after your contract date unless your date is rebooked which includes the $500 (of the $1,000) refundable clean-up/damage deposit. The remaining balance is due 60 days before your event.
pdf rate cards seen on site (not fetched): https://mtcb.colorado.gov/sites/mtcb/files/documents/SAMPLE%20CONTRACT%20MOUNTAIN%20WEDDING%20GARDEN_ADA.pdf

## google reviews (top 3)
- (5★ 2025-01) Considering a wedding at Mountain Wedding Garden in Crested Butte? Here's what you need to know! COST: This is truly one of the most affordable wedding venues in Colorado, starting at just $1500 for a weekday ceremony and reception. Which is crazy considering the beautiful views! Plus, there are no food and beverage minimums (since you'll need to provide that yourself) which saves you a lot. GUEST
- (5★ 2026-02) We've photographed many micro-weddings at Mountain Wedding Garden - here's what you need to know! LOCATION - The venue is located very close to town and there's a large parking lot with the venue just steps away, so it's very convenient and accessible for guests. The outdoor ceremony space and pavilion are right next to each other, so it's a great option to have the full wedding in one location. I
- (5★ 2026-01) Mountain Wedding Garden is one of the most beautiful wedding venues in Crested Butte, and over the years it's become one of our favorites! The view for the ceremony site is absolutely beautiful. With a jaw-dropping backdrop and some seasonal highlights (wildflowers in the Summer, leaves changing in Fall), this is one of the venues that fully embodies a Rocky Mountain Wedding. The reception space i

=== PHOTOGRAPHER: Nate & Jenny Weddings | vendor_id=37c6b382-0a01-4959-815e-18a98f0b04ab | bot=bot13 | date=8/2025 ===
# Nate & Jenny Weddings (Vail) — vendor_id=37c6b382-0a01-4959-815e-18a98f0b04ab
site=https://www.nateandjennyweddings.com/Connect/ | google 4.9★ × 40

## site pricing/package lines
We will craft a personalized package for you, and check in with you and your wedding team to make sure we know what means the most to you. We can deliver the day you have envisioned.
In addition, you will have the opportunity to add on custom albums, as well as pre-wedding and engagement sessions.

## google reviews (top 3)
- (5★ 2022-07) Nate and Jenny are the absolute BEST! Not only are they wonderful to work with, respectful, and FUN, they are immensely talented and clearly love what they do. Chris and I got married on an 18 degree NYE day. Jenny was the best cheerleader as we stood out in the cold for some amazing shots. She was efficient, decisive, and got all of the shots we wanted (and then some!) with our family and various
- (5★ 2025-07) Hiring Jenny as our wedding photographer was one of the best decisions we made! From our first conversation to the final gallery delivery, she was professional, warm, organized, and genuinely passionate about their work. On the day of the wedding, Jenny somehow managed to be everywhere without ever being intrusive. She captured the even the tiniest details in addition to the big special moments. S
- (5★ 2017-10) I cannot recommend Nate and Jenny enough! Hiring a photographer for my wedding day was my number one priority when it came to my vendor list and I was not willing to sacrifice on quality. Their level of professionalism, kindness, and attention to detail is beyond compare and my Husband and I look forward to our Anniversary each year because we sit down and look through all our wedding pictures the

=== PHOTOGRAPHER: ONCE WEST Photography | vendor_id=043477ef-9af0-49e8-8382-99810f7b0abd | bot=bot14 | date=8/2025 ===
# ONCE WEST Photography (De Beque) — vendor_id=043477ef-9af0-49e8-8382-99810f7b0abd
site=https://www.oncewest.com/ | google 5★ × 77

## site pricing/package lines
Buena Vista Elopement: Katie & Adam
Read More Buena Vista Elopement: Katie & Adam Continue
3. Select a package and payment plan.
4. Sign a contract and pay a retainer to lock in your date on our calendar.

## google reviews (top 3)
- (5★ 2024-08) Michele and Mark are simply AMAZING! I couldn't recommend them more! My husband and I wanted photographers who could capture the joy and emotion of our wedding day, rather than many posed shots, and they absolutely delivered. When we look back at the photos, it's like reliving the day all over again. Beyond the incredible photos, Michele is extremely responsive, organized, and fun to work with. Fr
- (5★ 2025-10) My husband and I absolutely loved working with Michele and Mark! We did an engagement session with Michele, and then both she and Mark photographed our wedding. The photos are stunning. They captured exactly how our day felt. Our album is so beautiful and full of the warmth and joy we felt during our wedding. I was initially nervous because my husband and I usually feel awkward in front of a camer
- (5★ 2025-12) Michele and Mark were one of the best choices we made for our wedding and our engagement photos. They were so easy to work with from the start, and on the wedding day they kept everything fun and completely stress-free. They blended right in with our friends and family and managed to capture every moment from the ceremony to the dance floor. When we got our final photos back, we were blown away wi

OUTPUT FILE: data/enrichvendors/photos-colorado/drafts/p1-worker-10.csv
