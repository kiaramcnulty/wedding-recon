# Type rules — hotel room blocks (`entries` blocks label: HOTEL (GUEST ROOM BLOCKS))

These are hotels that hold a **block of guest rooms** for a wedding. The subject is GUEST
LODGING and the economics of the block — not the wedding day, not event space.

## Wrong type? Two tiers (draft-contract has the full rule; write NO rows for either)
- `NOTHOTEL!:<slug>` (STRONG — positive evidence, auto-removed) — the dossier POSITIVELY
  shows this isn't a stay-only block property: a **wedding VENUE** whose pages sell
  ballrooms / ceremony sites / reception packages (**venue supersedes hotel** — that
  property belongs to the venue type, not here), a hostel, RV park or campground, a
  vacation-rental / short-term-rental or realty agency, extended-stay corporate housing,
  a timeshare, a travel agency, or another vendor type entirely.
- `NOTHOTEL:<slug>` (SOFT — a report, the orchestrator vets) — use this for the case that
  is specific to this type: **a real hotel with no evidence anywhere in the dossier that it
  takes wedding room blocks.** The directory's whole premise is documented blocks, so a
  hotel that can't clear that bar shouldn't ship — but confirm before removing, because
  block language hides on subpages a crawl may have missed. Draft nothing, flag it, and let
  the orchestrator decide.
- KEEP (never a flag): a hotel whose block comes with **no discount at all**. Plenty hold a
  block purely as an availability guarantee at the going rate — that is a legitimate,
  useful listing. Say so plainly; don't treat it as a defect or a wrong-type signal.
- KEEP (never a flag): a chain property whose evidence is **brand-level rather than
  property-level.** Big chains publish nothing useful about blocks at the individual-property
  level, so these arrive with little or no site material. **Thin research is NOT evidence that
  the property takes no blocks** — do not flag on that basis. When the research below carries
  a brand-level note (someone describing how Marriott / Hilton / Hyatt / Best Western /
  Quality Inn / Comfort Inn / Holiday Inn blocks work), that IS your evidence: this property
  is one of those, so write the entry.

  **Attribute it as brand-level and never launder it into a property-specific claim.** Right:
  "someone on reddit said any Marriott or Hilton property will do a room block with a signed
  agreement, attrition usually 90-95%; nothing specific published for this location, so the
  terms would come from their group sales desk." Wrong: "this hotel offers a room block with
  90-95% attrition" (states as fact about the property something the source said about the
  brand), or inventing a rate, minimum, or cut-off date the source never gave.

  **Say the fact, never the plumbing.** Write "they don't publish rates" or "nothing specific
  published for this location" — a couple would say that. NEVER reference how the research
  reached you or why it is thin: no mention of crawling, scraping, fetching, blocked or
  unreadable sites, HTTP status codes, automated lookups, research files, or this pipeline's
  own vocabulary. That an entry's source material was hard to gather is invisible to the
  reader and must stay that way.

## service_region — REQUIRED on every row
- The area its guests are staying for, sourced: the property's city/metro is the normal
  answer and an acceptable sourced fallback ("Denver area" from a Denver address). If the
  dossier ties it to a particular wedding corridor ("Boulder / Flatirons", "downtown, walk
  to Union Station"), prefer that narrower sourced region. Nothing at all → the run's state.
  Never invent; never blank (upload hard-fails).

## What couples actually want captured
- **Block type — lead with it when the dossier has it.** A **courtesy block** (rooms held,
  unbooked ones released back, the couple owes nothing) vs. a **guaranteed / attrition
  block** (the couple is contractually liable for a share of unbooked rooms). This is the
  single fact couples get burned by, and it is the most valuable thing an entry can carry.
- **Contract shape:** minimum room count, minimum nights, cut-off date, and — critically —
  whether **the couple prepays and is reimbursed** or **guests book and pay directly**.
  Most couples want the latter; say which one a source describes.
- **Rate reality:** the approximate nightly rate, and how the block rate compares to the
  property's normal rate — genuinely discounted, barely discounted, or purely an
  availability hold at rack rate. All three are worth writing; **"no real discount, but the
  rooms were held" is a legitimate, honest entry**, not a reason to skip the vendor.
- **Amenities that change the guest's bill:** parking and whether it's free, shuttle to
  venues, breakfast included, resort/facility fees, getting-ready suites, walkability or
  distance to popular venues.
- **Firsthand anecdotes are the main source here** (Kiara, 2026-07 — block terms are rarely
  published, so reviews and reddit carry this type). Did the block fill? Could guests
  actually find the block link? Did the hotel honor the rate? Was group sales responsive?
  Did the couple end up owing for unbooked rooms? Attribute it ("a couple on reddit said…",
  "a review mentions…"). Carry the wart when a source has one.

## price_details specifics
- Nightly room rate (a range is fine), block rate vs. normal rate, block type
  (courtesy/guaranteed) and any attrition percentage, minimum rooms/nights, cut-off date,
  deposit or prepay terms, parking and resort/facility fees, shuttle cost.
- **Do not confuse a published nightly rate with a block rate.** Booking-site nightly
  pricing is not evidence of block terms — label what you have. If only the general nightly
  rate is known, say that and say the block terms come from the group-sales contact.
- Never invent a number. "Block rate on request from group sales" is the honest fallback,
  and it is common and expected for this type.
