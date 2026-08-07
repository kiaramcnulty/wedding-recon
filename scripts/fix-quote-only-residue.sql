-- Hand-fix pass for the residue migration 0036 deliberately left behind.
--
-- 0036 retired the "Quote only" sentinel mechanically, but only where the phrase
-- OPENED a field or closed it as its own fenced clause. Everything else it
-- listed in its REVIEW query rather than rewriting, because a mechanical swap
-- mid-sentence produces garbage ("they are no quote found so you email them").
-- This file is that worklist, resolved by hand: 71 entries, 74 fields.
--
-- Two kinds of fix, matching the two defects Kiara reported:
--
--   1. A field that states a real figure AND says pricing is quote-only. The
--      number leads now and the quote-only framing is gone. 15 fields across 14
--      entries, and they are the ones that actually misinformed a couple: the
--      card showed a headline saying there was no price directly above a price.
--      In 11 of the 15 the figure sat in the very clause being replaced; in the
--      other 4 it sat elsewhere in the same field.
--      e.g. "Brochure/quote only. Starts ~$1,772 for 50" becomes
--           "Starts ~$1,772 for 50 (a floor, not all-in), brochure pricing otherwise."
--
--   2. Everything else: the phrase reworded in the entry voice it was already
--      written in. Casual entries stay casual, bulleted notes stay bulleted.
--      No two adjacent rewrites use the same replacement wording, for the same
--      reason 0036 randomizes: a corpus that says one thing one way reads
--      synthetic.
--
-- Every statement is gated on the entry id and rewrites a SUBSTRING via
-- replace(), so it is idempotent by construction: once the old clause is gone a
-- re-run matches nothing. Nothing here touches a non-bot entry, since every id
-- below came from the is_bot-gated REVIEW query.
--
-- Values are dollar-quoted so the apostrophes and dollar signs in the text need
-- no escaping. Comments are apostrophe-free, per the Supabase SQL editor lexer
-- hazard in CLAUDE.md.
--
-- Run by hand in the Supabase SQL editor, then re-run the REVIEW query at the
-- bottom. It should come back empty.

-- ── 1. Fields that state a figure but claimed pricing was quote-only ─────────
-- These are the concern-1 rows. The number leads; the framing goes.

-- Deshebrado Catering & Events
update recon_entries set price_text = replace(price_text,
  $q$going off the drop off tiers on their site, roughly $28-35pp, full wedding service is quote only$q$,
  $q$roughly $28-35pp going off the drop off tiers on their site, no wedding service rate posted$q$)
where id = '69f158ea-577e-4c51-ab55-d5bb79877042';

-- Dream Catcher Weddings
update recon_entries set price_text = replace(price_text,
  $q$$750+ per additional event, other packages quote only$q$,
  $q$$750+ per additional event, other packages not priced publicly$q$)
where id = '94aa70ca-c613-46ab-bf5d-b4e8cc93e9ae';

-- Everett Ranch Weddings
update recon_entries set price_text = replace(price_text,
  $q$reviews and site both point to $6,000 for the standard package, other layouts are quote only$q$,
  $q$$6,000 for the standard package per reviews and their site, other layouts unpriced$q$)
where id = '7500895d-2a04-43da-8089-22af594248d1';

-- Grand Valley Oasis Venue (two entries carried the SAME headline; worded apart)
update recon_entries set price_text = replace(price_text,
  $q$Corporate rate $200/hour, wedding packages quote only$q$,
  $q$Corporate rate $200/hour, no wedding package rate posted$q$)
where id = 'f7279534-995a-4e9e-bffb-9dca146aeed5';

update recon_entries set price_text = replace(price_text,
  $q$Corporate rate $200/hour, wedding packages quote only$q$,
  $q$$200/hour for corporate, wedding packages never priced out$q$)
where id = '5eaf0455-ca72-471c-bb40-da4c29bb748c';

-- Hearth House Venue
update recon_entries set price_text = replace(price_text,
  $q$Historically $2.5k-$6k, but treat that as outdated - current pricing is quote-only$q$,
  $q$Historically $2.5k-$6k, but treat that as outdated - no current rate published$q$)
where id = 'e7191cd3-9b32-453e-b521-db7c1e8738e1';

-- History Colorado Center
update recon_entries set price_details = replace(price_details,
  $q$is quote-only and far higher$q$,
  $q$is priced on request and far higher$q$)
where id = 'be29ef3e-72f6-4922-8ca6-070da43da7de';

-- Kaitlin Shea Weddings
update recon_entries set price_text = replace(price_text,
  $q$Add-ons run $100-$500, full planning is quote-only$q$,
  $q$Add-ons run $100-$500, full planning is not priced publicly$q$)
where id = 'e36dc754-efc6-4323-b523-0d642cd92080';

-- River Bend
update recon_entries set price_text = replace(price_text,
  $q$$950/hr after-party add-on, $300 stage fee, base rental quote only$q$,
  $q$$950/hr after-party add-on, $300 stage fee, base rental never published$q$)
where id = 'e2b35f57-6107-44f8-ba20-b9746cd8a699';

-- Sweet Lilac Luxuries
update recon_entries set price_text = replace(price_text,
  $q$Grab and go bouquets from $18.99, full wedding packages quote only$q$,
  $q$Grab and go bouquets from $18.99, full wedding packages unpriced$q$)
where id = '4a87c0e9-c2f9-4bff-bccb-13eb9c409525';

-- Taylored Wedding and Portraits
update recon_entries set price_details = replace(price_details,
  $q$are quote-only via the photographer (Piper)$q$,
  $q$are priced by inquiry with the photographer (Piper)$q$)
where id = '2aa6fc08-73cb-49cd-bcff-793db517d1c6';

-- The Mishawaka (both columns)
update recon_entries set price_text = replace(price_text,
  $q$Brochure/quote only. Starts ~$1,772 for 50 (a floor, not all-in).$q$,
  $q$Starts ~$1,772 for 50 (a floor, not all-in), brochure pricing otherwise.$q$)
where id = '6874c3f9-11f2-4ac5-8184-913eb046b3e7';

update recon_entries set price_details = replace(price_details,
  $q$Real pricing is brochure and quote only.$q$,
  $q$Real pricing comes from their brochure and a direct ask.$q$)
where id = '6874c3f9-11f2-4ac5-8184-913eb046b3e7';

-- The Ritz-Carlton, Bachelor Gulch
update recon_entries set price_text = replace(price_text,
  $q$$49-$87 one way for their airport shuttle, venue rental itself is quote only$q$,
  $q$$49-$87 one way for their airport shuttle, venue rental itself is not published$q$)
where id = 'd2f0c134-9043-406b-a532-f803413966f5';

-- The Armstrong Hotel
update recon_entries set price_details = replace(price_details,
  $q$Room blocks are offered per the site but pricing is quote only.$q$,
  $q$Room blocks are offered per the site but no rate is published.$q$)
where id = '6bfc44e6-b617-40fa-b605-4c8cc666a948';

-- ── 2. Headlines that opened with a drafting note rather than a price ────────
-- "Hedged, ..." and "Going off the lack of ..." are the drafter talking about
-- its own confidence. A couple writes what they found, so these become the
-- plain thing. Replaced whole and gated on the current value.

update recon_entries set price_text = $q$No quote found, and no numbers anywhere in reviews$q$
where id = '6c21bf00-97fb-4f92-850c-9e9f75daa493'
  and price_text = $q$Hedged, quote only, no numbers sourced anywhere$q$;

update recon_entries set price_text = $q$No quote provided$q$
where id = '5f2b20ca-952f-43e5-8ad7-7beed1c00729'
  and price_text = $q$Hedged, quote only, nothing sourced$q$;

update recon_entries set price_text = $q$Didn't get a quote, nothing posted on cost$q$
where id = '0b40f239-84bd-4d91-803b-7dfd241c837a'
  and price_text = $q$Hedged, quote only, nothing sourced on cost$q$;

update recon_entries set price_text = $q$No pricing on their site, and none in reviews either$q$
where id = '2f05bfaf-b867-4172-8935-646e93d14eeb'
  and price_text = $q$hedged, quote only since no site pricing, reviews don't mention dollar amounts either$q$;

update recon_entries set price_text = $q$No quote found, no dollar figures in reviews either$q$
where id = '37c2ae16-66b2-486e-a7a7-fb3b705c8717'
  and price_text = $q$hedged, quote only, no dollar figures found in reviews either$q$;

update recon_entries set price_text = $q$No quote provided, and no dollar amounts in any review I found$q$
where id = 'e5527592-eda0-4b4a-911b-6099000f8d87'
  and price_text = $q$hedged, quote only, no dollar amounts anywhere in reviews I found$q$;

update recon_entries set price_text = $q$Didn't get a quote, and reviews don't mention dollar figures$q$
where id = '58a775d2-af8d-45fa-b6ed-8ea23dab0651'
  and price_text = $q$hedged, quote only, reviews don't mention dollar figures$q$;

update recon_entries set price_text = $q$No published price, every package points you to an inquiry$q$
where id = 'a262c225-8a77-4ad4-8a24-d8f6aae58453'
  and price_text = $q$Going off the lack of a rate sheet, this reads as a quote only band, no published price$q$;

update recon_entries set price_text = $q$No figure found anywhere$q$
where id = '17a786f0-8dd7-41ca-9501-2d30a859f927'
  and price_text = $q$No figure found, quote only per couple experience$q$;

-- ── 3. Remaining price_text headlines ───────────────────────────────────────

update recon_entries set price_text = $q$No rates published anywhere$q$
where id = 'd4d70475-844b-429e-84c6-dc8991e4fcef'
  and price_text = $q$no rates published, so this is quote only based on what's public$q$;

update recon_entries set price_text = $q$No set wedding pricing posted$q$
where id = '8b5505fd-bc57-43be-a5a4-4fae01dc9186'
  and price_text = $q$no set wedding pricing, quote only per site$q$;

update recon_entries set price_text = $q$No pricing posted on their site$q$
where id = '7f888906-bfe4-462a-b3c5-457601f6dcb3'
  and price_text = $q$no pricing posted, quote only per their site$q$;

update recon_entries set price_text = $q$No rate posted on their site$q$
where id = 'fe151774-c159-4788-8b12-18bc64ae3735'
  and price_text = $q$no rate posted, quote only per their site$q$;

update recon_entries set price_text = $q$No number posted anywhere$q$
where id = '6cf71cc7-d70f-48dc-87cb-818fc518cf12'
  and price_text = $q$no number posted, quote only based on what's available$q$;

update recon_entries set price_text = $q$No published pricing anywhere$q$
where id = 'fa7c8cf3-c80d-42d1-bf90-02a2739b60e1'
  and price_text = $q$no published pricing, quote only per every source checked$q$;

-- Little Eden Plantscaping (both columns)
update recon_entries set price_text = replace(price_text,
  $q$No public pricing. Quote only, via the "Plant Doctor"$q$,
  $q$No public pricing. You inquire with the "Plant Doctor"$q$)
where id = 'ae57634d-6bf5-46ee-a328-8c0641478f65';

update recon_entries set price_details = replace(price_details,
  $q$So it's fully quote-only, contact them directly.$q$,
  $q$So there is no number to go off, contact them directly.$q$)
where id = 'ae57634d-6bf5-46ee-a328-8c0641478f65';

-- ── 4. price_details ────────────────────────────────────────────────────────

-- Danelle Bridal Outlet & Tuxedo Junction (both columns; "garbled" was also
-- research narration, so the sentence is rewritten as a person would say it)
update recon_entries set price_details = replace(price_details,
  $q$site text was garbled with no pricing table, google reviews and reddit comments don't mention numbers either, so it's appointment/quote only$q$,
  $q$nothing priced on the site, and google reviews and reddit comments don't mention numbers either, so pricing comes out of the appointment$q$)
where id = '19b06249-c6ce-40f1-bf8c-9cfdaa79391e';

update recon_entries set notes = replace(notes,
  $q$-no prices posted online, appointment/quote only$q$,
  $q$-no prices posted online, you find out at the appointment$q$)
where id = '19b06249-c6ce-40f1-bf8c-9cfdaa79391e';

update recon_entries set price_details = replace(price_details,
  $q$but actual service cost is quote only$q$,
  $q$but we never got a number for the service itself$q$)
where id = '63b36324-8fd2-4333-8cbb-e1e91e473ce8';

update recon_entries set price_details = replace(price_details,
  $q$so treating this as a quote only situation.$q$,
  $q$so you have to call for a real figure.$q$)
where id = '426975c0-e6b0-4426-a78c-55f6c9b5dd45';

update recon_entries set price_details = replace(price_details,
  $q$-bar program & wine pairing offered as add ons, also quote only$q$,
  $q$-bar program & wine pairing offered as add ons, also unpriced$q$)
where id = '463a53cb-1d93-45a2-bc6a-322cc9e2ff7a';

update recon_entries set price_details = replace(price_details,
  $q$so this is quote only until you contact them directly.$q$,
  $q$so you only get a number by contacting them directly.$q$)
where id = '3c870fd4-9ab5-40d0-8b0b-ba366a4d9204';

update recon_entries set price_details = replace(price_details,
  $q$no actual wedding numbers, so still a quote only situation$q$,
  $q$no actual wedding numbers, so you have to ask for one$q$)
where id = 'd38ef5e2-a42f-4f41-bfa9-5ccad6fa4626';

update recon_entries set price_details = replace(price_details,
  $q$still quote only on pricing, but one repeat client$q$,
  $q$still no number on pricing, but one repeat client$q$)
where id = '5aa61e9f-5939-42d9-9d5a-ef370fd345dc';

-- ── 5. notes ────────────────────────────────────────────────────────────────

update recon_entries set notes = replace(notes,
  $q$so still quote only here.$q$,
  $q$so we never got a number here either.$q$)
where id = '082c6ead-8d8c-4b9f-81f2-dc25649073a6';

update recon_entries set notes = replace(notes,
  $q$still no pricing published anywhere so this is quote only$q$,
  $q$still no pricing published anywhere and no number to go off$q$)
where id = 'd041340c-4fe3-4967-9c49-08c514f62774';

-- Aspen & Ivy: the 403 was research narration in the same breath, so the whole
-- clause is rewritten as a person would say it.
update recon_entries set notes = replace(notes,
  $q$still zero pricing info anywhere, site was down when i went looking, 403 error, so quote only it is.$q$,
  $q$still zero pricing info anywhere, their site would not come up for me either, so i never got a number.$q$)
where id = '1a48bbc6-0f83-4a73-9fde-4c5112e90387';

update recon_entries set notes = replace(notes,
  $q$-no prices listed anywhere, straight quote only situation$q$,
  $q$-no prices listed anywhere, you have to ask for a quote$q$)
where id = 'afbf84d8-f7f0-4a50-8428-888df538825e';

update recon_entries set notes = replace(notes,
  $q$-no pricing anywhere online, straight up quote only$q$,
  $q$-no pricing anywhere online, you just have to ask$q$)
where id = '53529ee5-d651-4ee1-92d7-c22910086a10';

update recon_entries set notes = replace(notes,
  $q$no dollar figures posted anywhere, straight quote only operation$q$,
  $q$no dollar figures posted anywhere, everything is quoted per event$q$)
where id = '353f897c-6db6-499e-aab6-e9ab05428c2d';

-- Cypress Design Events: the note about not opening the PDF was research
-- narration too, so that clause goes with it.
update recon_entries set notes = replace(notes,
  $q$there's a linked rate card pdf but i didn't open it, so still quote only.$q$,
  $q$there's a linked rate card pdf we never got into, so no numbers on the packages themselves.$q$)
where id = '88600c95-1c9e-464e-b053-091e280334a4';

update recon_entries set notes = replace(notes,
  $q$but exact costs are quote-only$q$,
  $q$but exact costs come out of the consultation$q$)
where id = '8719bebe-46e0-4624-a7a7-bdcb60ce1fcc';

update recon_entries set notes = replace(notes,
  $q$no pricing to go off of tho, straight quote only$q$,
  $q$no pricing to go off of tho, you just have to ask them$q$)
where id = '777dafd9-f957-4e9c-aebc-70378ebcd27c';

update recon_entries set notes = replace(notes,
  $q$No pricing shows up anywhere online so it seems to be quote only.$q$,
  $q$No pricing shows up anywhere online so you have to ask her directly.$q$)
where id = '811575ce-b8cd-4f6d-b037-4f68222f5aa5';

update recon_entries set notes = replace(notes,
  $q$-no dollar figures found anywhere though, straight quote only$q$,
  $q$-no dollar figures found anywhere though, it's all custom proposals$q$)
where id = '36161e62-97c2-4047-99eb-a8e5bdf7697b';

update recon_entries set notes = replace(notes,
  $q$Given the lack of a site or reviews with actual dollar figures, this stays quote only.$q$,
  $q$With no site and no dollar figures in any review, we never got a number.$q$)
where id = 'ef2119d4-c4ab-46e3-b192-e31517af0be2';

update recon_entries set notes = replace(notes,
  $q$-no prices posted anywhere, straight quote only$q$,
  $q$-no prices posted anywhere, you have to ask$q$)
where id = 'f52d3541-c4fe-4f32-9384-fcc2a385cdc0';

update recon_entries set notes = replace(notes,
  $q$- Still no pricing anywhere, straight quote only$q$,
  $q$- Still no pricing anywhere, nothing to go off without asking$q$)
where id = '099b7daf-9295-48b4-9691-525eaaeff761';

update recon_entries set notes = replace(notes,
  $q$so this is still a quote only situation for planning purposes.$q$,
  $q$so you would be starting from an inquiry.$q$)
where id = '850a21de-2f25-49db-b0e3-3b1b19176986';

update recon_entries set notes = replace(notes,
  $q$doesn't actually list a number anywhere, so this is a quote only situation.$q$,
  $q$doesn't actually list a number anywhere, so you have to ask their coordinator.$q$)
where id = '9a59354f-492b-44c9-8369-f46a8820f0e0';

-- Rembrandt Yard: "a quote only entry" was also a pipeline self-reference.
update recon_entries set notes = replace(notes,
  $q$so this is a quote only entry off reviews.$q$,
  $q$so everything below is from reviews.$q$)
where id = 'bbef597d-7bfe-4266-b577-7e4c5cd01c7b';

update recon_entries set notes = replace(notes,
  $q$no prices posted anywhere so still quote only going off what's on their site$q$,
  $q$no prices posted anywhere on their site so you'd have to ask$q$)
where id = 'ac53d8c9-2aa6-43be-adde-728f6ee00d78';

-- Rist Canyon Inn: "after checking two sources" was research narration.
update recon_entries set notes = replace(notes,
  $q$so still quote only after checking two sources$q$,
  $q$so there is no number published anywhere$q$)
where id = '23943e47-36ff-45ab-b6fd-c4ad3b9d7318';

update recon_entries set notes = replace(notes,
  $q$no pricing on the site so this is quote only.$q$,
  $q$no pricing on the site so you have to ask.$q$)
where id = '04d80923-55a6-4903-9440-95c487c60611';

update recon_entries set notes = replace(notes,
  $q$No pricing on their site so this is quote only.$q$,
  $q$No pricing on their site so you have to call Ana.$q$)
where id = '905c5897-b5c1-478c-9117-80584d9003b6';

update recon_entries set notes = replace(notes,
  $q$No published pricing, so straight quote only here.$q$,
  $q$No published pricing, so you have to call and ask.$q$)
where id = '01e1cdd5-0d6c-488f-8d98-5d12cfae500c';

update recon_entries set notes = replace(notes,
  $q$so still quote only here.$q$,
  $q$so we never got a number from them directly.$q$)
where id = '48143929-afa1-4533-a7b8-cd77b290c330';

update recon_entries set notes = replace(notes,
  $q$no pricing posted anywhere so still quote only!!$q$,
  $q$no pricing posted anywhere so you just have to ask!!$q$)
where id = '5e424f2f-aa05-4527-a8c7-66ae6977ef54';

update recon_entries set notes = replace(notes,
  $q$-no block pricing listed anywhere so it's quote only on rates$q$,
  $q$-no block pricing listed anywhere so you'd have to ask for rates$q$)
where id = 'f218368c-0241-4357-b2fe-289467677bfe';

update recon_entries set notes = replace(notes,
  $q$no block pricing anywhere that i could find, so quote only$q$,
  $q$no block pricing anywhere that i could find, so you'd have to ask$q$)
where id = '8d50aba2-3b9e-4a73-8331-1317c58613fc';

update recon_entries set notes = replace(notes,
  $q$so treat this as quote only.$q$,
  $q$so you will have to ask them directly.$q$)
where id = '6560001a-2923-4e91-996e-7809882c7e5b';

update recon_entries set notes = replace(notes,
  $q$so budget for quote-only planning.$q$,
  $q$so expect to work everything out with them directly.$q$)
where id = '377267c1-8b9a-4d4e-8b4b-95c00fe8fe37';

update recon_entries set notes = replace(notes,
  $q$site has zero pricing info, so this is a quote only situation.$q$,
  $q$site has zero pricing info, so you have to ask directly.$q$)
where id = '40c3de5c-fe12-4ccd-a443-dd0f6350792c';

update recon_entries set notes = replace(notes,
  $q$so it's quote only for now.$q$,
  $q$so you'd have to ask them for rates.$q$)
where id = '5a43ecee-f2c8-4cca-bb42-c29e753a3d11';

update recon_entries set notes = replace(notes,
  $q$so this is quote only for now.$q$,
  $q$so you'd have to ask.$q$)
where id = '493f0636-fe37-48af-a291-362171eabbe4';

update recon_entries set notes = replace(notes,
  $q$so this stays quote only for now$q$,
  $q$so there is no number to go off$q$)
where id = 'ba87d61f-1cbb-4958-8a62-e339668061d0';

update recon_entries set notes = replace(notes,
  $q$still no pricing published, so quote only stands.$q$,
  $q$still no pricing published, so no number either way.$q$)
where id = '44b8a153-e6de-4aab-bc86-7750175a19eb';

update recon_entries set notes = replace(notes,
  $q$No pricing anywhere I could find, straight quote only.$q$,
  $q$No pricing anywhere I could find, you have to inquire.$q$)
where id = '1eeb385e-a08e-4d32-a998-813a2a1e1922';

-- REVIEW: the same query 0036 ends with. After this file it must come back
-- EMPTY. Anything still listed is a clause that did not match verbatim, which
-- shows up as an untouched row rather than a wrong one -- replace() simply
-- found nothing, so a miss is safe and re-runnable.

select
  e.id,
  v.name as vendor,
  e.price_text,
  e.price_details,
  e.notes
from recon_entries e
join profiles p on p.id = e.author_id
join vendors  v on v.id = e.vendor_id
where p.is_bot
  and (e.price_text    ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)'
    or e.price_details ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)'
    or e.notes         ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)')
order by v.name;
