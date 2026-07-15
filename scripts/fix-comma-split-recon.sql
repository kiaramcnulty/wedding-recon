-- Repair comma-split bot recon entries (2026-07 enrich batch, worker-written
-- CSV era). A "$X,YYY" dollar amount was torn at the comma when the row was
-- serialized: price_text kept "...$X", the "YYY" thousands fragment landed at
-- the front of price_details, and the real pricing prose got pushed one field
-- over into notes. Each fix below rejoins the number in price_text and
-- re-partitions the displaced prose back into price_details / notes using the
-- entry's own verbatim text (no rewording).
--
-- Run by hand in the Supabase SQL editor. Idempotent: every UPDATE is gated on
-- the broken price_text value, so re-running after a fix touches zero rows.
-- Values use dollar-quoting ($fix$...$fix$) so the apostrophes and "$" signs in
-- the text need no escaping.

-- Katie Blondin Photography (fixed in the first pass; kept for a clean re-run)
update recon_entries set
  price_text    = $fix$Starting at $3,400$fix$,
  price_details = $fix$Her own site doesn't post pricing. The $3,400 starting figure comes from a listing elsewhere, with no hours or tier breakdown to confirm what it includes.$fix$,
  notes         = $fix$Style reads as classic with a fun, personable approach, natural-looking poses rather than stiff posed shots. Based in Littleton.$fix$
where id = '4df52cef-378f-4be6-9810-19ce45af90d1' and price_text = $fix$Starting at $3$fix$;

-- Forest Picture Company
update recon_entries set
  price_text    = $fix$Starting around $5,500$fix$,
  price_details = $fix$Site didn't have a pricing page up when we checked. Starting rate found elsewhere was around $5,500, and that figure is said to include engagement photos, though no hours or add-on list beyond that.$fix$,
  notes         = $fix$Their listed style is photojournalistic, described as capturing adventurous, heartfelt wedding moments rather than posed shots. The starting rate we found was around $5,500 and apparently that already bundles in an engagement session, though we could not find a breakdown of coverage hours to go with it. Based in Fort Collins, so probably a good fit if your wedding is up in that corner of the state.$fix$
where id = '409f5043-4b35-452b-ab9e-e0b7eb9dcf3c' and price_text = $fix$Starting around $5$fix$;

-- Siroky Photography
update recon_entries set
  price_text    = $fix$Wedding photography starts at $2,500$fix$,
  price_details = $fix$Essential Collection is $2,500 with additional hours at $750 each. Engagement sessions start separately at $500. Site says packages are flexible if you need something different, you just have to contact them.$fix$,
  notes         = $fix$Colorado Springs based, photographer Jerry comes up by name in every review. 231 reviews and consistently 5 stars across weddings and family sessions both, which says something about volume. One reviewer called him easy going but professional and said he brings infectious energy to a shoot, another said he has an eye for scenery that surpasses others they've used.$fix$
where id = '51af18f3-816a-452d-b913-93fd32987c25' and price_text = $fix$Wedding photography starts at $2$fix$;

-- George Street Photo & Video
update recon_entries set
  price_text    = $fix$Starting at $1,695$fix$,
  price_details = $fix$found via The Knot: starting rate is $1,695 for photo AND video coverage together. that's a combined package price, no separate photo-only rate listed, and no hours or tier info beyond the headline number.$fix$,
  notes         = $fix$found a whole thing on this denver studio through the knot, they start at $1,695 which covers both photo and video together lol, definitely towards the budget end for a bundled package. couldn't find anything on their actual site about hours or what tiers look like above that though, so you'd have to call and ask imo$fix$
where id = '3968266a-54b1-40c6-9d4d-5fc05a2514a0' and price_text = $fix$Starting at $1$fix$;

-- Thistle and Pine Photography
update recon_entries set
  price_text    = $fix$Packages start at $5,000$fix$,
  price_details = $fix$Three inclusive packages starting at $5,000, with custom quotes available if your coverage doesn't fit the standard hourly tiers. A phone call is offered before booking if you want to talk it through first.$fix$,
  notes         = $fix$She shoots both film and digital and specializes in Scotland and Ireland elopements specifically, though she says she'll travel wherever, and she also thrifts vintage photo albums and handwrites love letters for her couples as a keepsake. Mandie runs Thistle and Pine out of Colorado Springs and her site leans hard into a nostalgic, film-forward style, one review called it capturing things in an authentic but refined way rather than a staged version of the day. A couple from Massachusetts said their communication with her from Colorado was excellent even before they met in person for the actual shoot. Multiple reviews specifically praised her humor and how she made posing feel less intimidating for camera-shy people.$fix$
where id = 'd3f4b1b3-ba15-46cd-8f9e-1a10a12a8820' and price_text = $fix$Packages start at $5$fix$;

-- Tina Joiner Photography
update recon_entries set
  price_text    = $fix$Collections start at $5,850$fix$,
  price_details = $fix$Collections start at $5,850 with your date locked in via signed contract and a retainer. The site notes separate permit fees for certain shoot locations, $50 for one and $300 for another, though it doesn't say which spots those apply to.$fix$,
  notes         = $fix$She's based in Colorado Springs but says she's available worldwide for destination weddings and elopements. One review said choosing Tina was the single most agonized-over decision of the whole wedding, more than the dress or the venue, and it paid off. Another mentions Summer, who appears to be a second shooter on her team, traveling offsite with the couple for mountain photos and even helping bustle the bride's dress. A different reviewer said Tina handled a wedding-day hiccup professionally, which is a good sign for how she reacts when something actually goes wrong.$fix$
where id = 'd6db1701-3e97-4e09-922a-19098e0c2fdf' and price_text = $fix$Collections start at $5$fix$;

-- Jenny JaeMin Photos
update recon_entries set
  price_text    = $fix$Minimum $7,500$fix$,
  price_details = $fix$Their minimum booking is listed at $7,500. Style described as documentary plus editorial, and coverage is a mix of digital and 35mm film. No tier breakdown, hours, or add-ons found beyond that floor price.$fix$,
  notes         = $fix$- Review roundup: Style = documentary + editorial
- Shoots BOTH digital and 35mm film, so if you want that film grain in your gallery this is one to look at
- Minimum spend starts at $7,500, no lower tier found, so this is more of a splurge pick than a budget one$fix$
where id = '776107db-3b19-482a-be84-2dfaa9514b95' and price_text = $fix$Minimum $7$fix$;

-- Mike Kory Photography
update recon_entries set
  price_text    = $fix$Starting around $2,800 per WPJA$fix$,
  price_details = $fix$WPJA lists him starting around $2,800. He shoots documentary style and is listed as an associate photographer at Bonnie Photo, so it's possible some bookings route through that studio rather than an independent contract. No tier breakdown or hours included at that starting price surfaced anywhere.$fix$,
  notes         = $fix$Interesting background on this one. He was a mechanical engineer before switching to documentary style destination wedding photography, which explains some of the more technical talk in his bio about off camera lighting for dusk and night shots. He doesn't appear to have his own website right now, he's listed as an associate photographer under Bonnie Photo, so you may end up booking through them. No firsthand reviews with real detail came up in my search, just the professional bio and pricing reference.$fix$
where id = 'f381dbca-fc47-42ef-ae21-2a5f8b493d2c' and price_text = $fix$Starting around $2$fix$;

-- Hughes Photo Co.
update recon_entries set
  price_text    = $fix$Wedding collections start at $6,500$fix$,
  price_details = $fix$Collections begin at $6,500 (site also lists a $6,000 starting figure elsewhere, may be an older number). Every package includes rehearsal coverage. Couldn't find a breakdown of hours or add-ons like second shooter or albums, site keeps it vague and points you to a consult to pick a collection.$fix$,
  notes         = $fix$Went looking for their editorial stuff since that's what they're known for and the site backs it up, called high-fashion editorial in one summary. Rehearsal day coverage baked into every package is a nice touch most photographers charge extra for. Colorado Springs based. Didn't find a single review, good or bad, just the pricing page and portfolio.$fix$
where id = 'd8cbd6b6-1c9b-475a-823b-1ad41687e8b6' and price_text = $fix$Wedding collections start at $6$fix$;

-- Joe Pyle Photography
update recon_entries set
  price_text    = $fix$Around $3,400 starting per a wedding photojournalist directory listing$fix$,
  price_details = $fix$site doesn't list flat numbers but does explain the process: free engagement session included with any package of six hours or more, two lead photographers on every wedding (no assistants or second shooters per their site), 30% retainer required to hold your date with the balance due later, they customize packages if six-plus hours doesn't fit your budget$fix$,
  notes         = $fix$Joe and Kari Pyle are a husband-wife team based near Estes Park who specialize in Rocky Mountain National Park weddings and elopements, full-time since 2013 with 400+ weddings under their belt according to a regional pricing writeup. Reviews consistently say they feel like friends rather than vendors, one reviewer specifically mentions them helping with a bride's train and veil throughout the day. Multiple reviews mention winter RMNP elopements and the site itself pitches winter as underrated for snow-covered peaks and frozen lakes. They also cover other Estes venues like The Stanley Hotel and Della Terra per that guide.$fix$
where id = '3cdc4aea-501e-482b-948f-b37707b6c1e7' and price_text = $fix$Around $3$fix$;

-- Lauren Leyba Photography
update recon_entries set
  price_text    = $fix$Starts at $5,000$fix$,
  price_details = $fix$couldn't find a package breakdown anywhere, just that packages start at $5,000 and go up from there depending on coverage. no mention of what hours or add ons that opening price includes so you'd have to ask.$fix$,
  notes         = $fix$Went looking for reviews on this one and mostly found her own site copy describing a photojournalistic, documentary approach, catching details and emotions as they happen rather than posed shots. A wedding planner blog mentioned her as a Denver photographer worth a look for couples who want candid coverage over formal portraits. No price breakdown by hours or package tiers anywhere, just the $5k starting figure. Would want an actual conversation before booking to know what that includes.$fix$
where id = 'f965afdc-c084-4e13-9aac-067b39a488d8' and price_text = $fix$Starts at $5$fix$;

-- Confirm nothing is still torn. Expect zero rows after the updates above.
select v.name, p.username, e.id, e.price_text, left(e.price_details, 40) as price_details
from recon_entries e
join vendors v on v.id = e.vendor_id
join profiles p on p.id = e.author_id
where p.is_bot
  and e.price_text ~ '\$\d{1,3}$'
  and e.price_details ~ '^\d{3}([^0-9]|$)';
