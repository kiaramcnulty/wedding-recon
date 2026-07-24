# Type rules — bridal shops (`entries` blocks label: BRIDAL SHOP)

These are shops where a BRIDE buys or orders a WEDDING GOWN (most also carry bridesmaid / bridal-party / accessories). Content is about the DRESS-shopping experience, not the wedding day.

## Wrong type? Two tiers (draft-contract has the full rule; write NO rows for either)
- `NOTDRESS!:<slug>` (STRONG — positive evidence, auto-removed) — the dossier POSITIVELY shows
  this is a different business: a wedding-GUEST / cocktail / evening / prom / mother-of-the-bride
  attire shop with **no bridal gowns**, a menswear/tuxedo shop, a jeweler, a dress
  alterations / preservation / dry-cleaning service, a costume shop, or another vendor type.
  (Signals: site sells only guest/formal/prom dresses; "tuxedo rental"; "we clean & preserve
  your gown" with no gowns for sale.)
- `NOTDRESS:<slug>` (SOFT — looks off but not certain) — draft the row(s) normally and flag;
  the orchestrator vets before removing.
- KEEP (never a flag): a shop that sells bridal gowns AND ALSO stocks bridesmaid, guest,
  mother-of-the-bride, or accessory items is a bridal shop — the extra inventory is normal.
  A bridal-PARTY-only shop (bridesmaids/flower-girl, no bride gowns) is a soft judgment call:
  draft normally, flag `NOTDRESS:` and note it's party-only.

## service_region — REQUIRED on every row
- Where they serve, sourced: site copy, stated appointment area. Narrowest sourced wins.
  **A storefront's city/metro is an acceptable sourced fallback** ("Denver area" from a Denver
  address) — most bridal shops are storefronts, so this is the common case. Nothing at all →
  the run's state. Never invent a narrow region; never blank (upload hard-fails).

## What couples actually want captured
- **Designers / labels carried** — the single most-searched fact for this type. Name the ones
  the dossier lists (e.g. Maggie Sottero, Essense, Made With Love, Pronovias). If the shop is
  known for a niche (all-modest, plus-size-inclusive, boho, indie/small-designer), say so.
- **Price ranges — anecdotes are the highest-value content** (like florists): a real figure
  someone actually PAID for their gown here ("I got my dress for about $1,800") beats a posted
  "starting at." Attribute it ("a bride on reddit said...", "a review mentions..."). Carry the
  wart when a source has one (pushy sales, limited size range, long alteration waits).
- **Try-on process:** appointment required vs. walk-ins welcome, private-suite vs. shared floor,
  appointment/consultation fee, how far ahead to book, sample-size range, how many guests
  allowed. Couples plan around this — it's core intel.
- **Scope & timeline:** bridal gowns only or also bridesmaids / mothers / accessories (veils,
  etc.); off-the-rack vs. made-to-order / special-order lead times; whether alterations are
  in-house.

## price_details specifics
- Gown price bands (sample-rack / off-the-rack vs. designer / made-to-order), trunk-show and
  sample-sale pricing, appointment or consultation fees, deposit / payment terms, alteration
  costs if stated. One bride's real spend from a review or reddit is a great sourced data point.
  Never invent a number; "quote/appointment only" is the honest fallback when nothing is posted.
