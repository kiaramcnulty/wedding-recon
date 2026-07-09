# CO photographer enrich run — state (2026-07-09, unattended)
Pre-authorized by Kiara: upload runs to completion if dry-run clean; CO roster (17 bots) reused;
scope all 313 w/ THIN floor-skips; TEXT only this run (photo pass follow-up, target ~3/vendor).
Batch id: p1. Roster: data/enrichvenues/rosters/CO.json.
- [x] research copied (7 reddit + ig-01) + launchintel digest
- [ ] harvest 313 (background)
- [x] pricing pass (5 digests: 5 vendor + 27 market lines)
- [x] slices / - [ ] dossiers (awaiting harvest)
- [ ] batch p1 + draft workers (~21 calls)
- [ ] status/merge/dry-run fixes
- [ ] apply + verify loop
- [ ] report + memory
## Worker flags (accumulating; slugs are worker-constructed — map via manifest)
RICH: bonnie-photo, elevate-photography, catherine-norwood-denver-wedding-photographer, doug-treiber-photography, aamodt-studio, addie-knott-photography, alexi-hubbell-photography, antler-run-photography, samuel-marz
NOTPHOTOG: breckenridge-photographics, embodied-art-boudoir, emerald-fox-boudoir, emily-o-photography, fanciful-floral-weddings, fawntail-boudoir-photography, for-wild-love, four-corners-digital-imagery, four-seasons-vail, colorado-wedding-and-elopement-officiant-julie-adriansen, distinctive-mountain-events, donovan-pavilion, eaglevail-pavilion, aesthetic-collective, boho-chic-boudoir-by-kara-cavalca
THIN: candace-cross-photography, candid-studios-colorado-springs, candid-studios-fort-collins, carissa-marie-photography, carl-bower-photographs(WRONG-has-$4k-flat-fee), cassidy-cheyenne-photography, dre-lamar-photography, samantha-dixon-photography, alex-benavidez, jordan-gresham-photography, rebecca-milan-photography, bluespruce-photography
Post-merge TODO: audit THIN dossiers containing $ or reddit lines → inline-draft recoverables; confirm each NOTPHOTOG dossier before removal (created_by guard).
More flags (waves 2-3):
RICH: kalen-jesse-photography-co, vows-and-peaks, from-the-hip-photo, kate-ivy-photography, evie-joy-photography, nina-reed-larsen-photo-co, photos-by-elliot, savannah-chandler-photography, taylored-wedding-and-portraits, tom-k-photo, tomi-photopositive, alyssacarpenterphotography, amandapodestaphotography, angelaamenphotography, ashleykristinephoto, autumnparryphotography, aylaraeweddings, bergbergphotography
NOTPHOTOG: lucky-penny-event-planning(row pre-dropped), gary-soles-gallery, gigi-c-weddings, glitter-and-bliss-wedding-planning-events, sunbeam-studio, telluride-presents, telluride-ski-resort-weddings-events, the-cheers-company, the-landing-at-estes-park, the-pavilion-at-the-stanley, veils-of-vail-wedding-planning-design, venue-on-the-rocks, vail-mountain-wedding-deck
THIN: light-in-motion-co(row pre-dropped), grumpyhighlander, kayla-aug, kiku-ishi, lauren-vandame, m-nichole, makaila-rosin, melanie-joy, emily-beltran, flor-de-campo, gracie-marie, homeland, jess-co, jessica-cooke, jo-mcgowan, kaitlyn-marie, sharee-davenport, taryn-ashlee, yoni-gill, wmtco, abbyshepard, alexmabrey, creative-by-antonella, eliza-wildflowers, kokoro, prism-create
Pre-cleaned: worker-09 (2 rows dropped), worker-14 (stray 13th field stripped).
Retry flags: 08 → RICH: jmgant, joe-pyle, justin-edmonds | NOTPHOTOG: janna-lynn-photography | THIN: jennifer-glenn. 11 → RICH: rogue, ryan-kost | NOTPHOTOG: party-girl-events, princess-productions, ranjani-groth-studios, real-west-old-time-photography, river-bend-ranch. 12 → RICH: signature-destination | NOTPHOTOG: sonnenalp-vail, snappr-photography, story-lens-photography.
CSV serialization issue found (multi-line/unquoted-comma notes; root cause: voice-card bullet examples vs one-line rule) → 11 repair agents on workers 02,03,04,05,06,09,10,13,14,17,21. Post-run skill fix: voice-cards one-line bullet note.
