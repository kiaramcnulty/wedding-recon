# Type card: hair & makeup (`--type hairmakeup`)

Profile key `beauty` → `vendor_type='beauty'` (app category: Sparkles icon, teal; label "Hair & makeup", plural copy "hair & makeup artists"), working CSV `vendors.csv`. **Captures instagram** → bare handle in `vendors.instagram`. Accepts aliases `hairmakeup`/`hair-makeup`/`hair`/`makeup`/`beauty`/`hmua`/`glam`/`stylist(s)` (write "hair and makeup" or "hair & makeup" in the invocation and normalize it to one token yourself).

**Preflight:** migration `supabase/migrations/0022_add_beauty_vendor_type.sql` (the `beauty` enum value) **and** `0016_vendor_instagram.sql` must both be hand-applied (Supabase SQL editor) before Phase 5. `0016` is the same column photographers and dress shops use; if an earlier run applied it, only `0022` is new. Upload fails on an unknown enum value with a Postgres error — confirm both with the user in Phase 0.

## Ground truth
- **ONE joint type, on purpose.** Most of these vendors do hair AND makeup. An artist who does **only hair** or **only makeup** still belongs here — include them and record which in `intel`; do not treat one-service artists as out of scope. Also note whether they cover the **bridal party** (bridesmaids, mothers, flower girls) or **the bride only** — a bride-only artist is still valid, just narrower.
- **Mobile-first, like photographers and planners.** Many are solo artists or small teams who travel to the couple's getting-ready location and have no Google Maps storefront (or list a home address they'd rather not publish). Expect a **thin sweep and a high centroid/no-match rate** — that's normal, say so rather than calling it a failure. Studio-based artists and salons with a bridal arm are the storefront minority.
- **Websites are often informal or absent — Instagram is frequently the real portfolio.** Hunt the handle hard (see the IG hunt below); for this type it's the highest-value field after the name.
- **Everyday salons are the sweep's biggest false positive.** A hair salon that has never done a wedding is not this type. `wedcheck` sorts on bridal evidence; a salon with a real bridal/wedding page or wedding-mentioning reviews IS in scope.
- **Excluded (different businesses):** nail salons, barbershops, med spas / botox / laser / injectables, tanning, waxing/threading, lash-extension-only and brow-only bars, permanent makeup / microblading studios, massage, beauty-supply retail, cosmetology schools, and wig / hair-restoration shops. Most are pruned by name at sweep time. A **spa or salon with a genuine bridal hair-and-makeup service is NOT excluded** — the exclusions are businesses whose product isn't wedding-day hair or makeup at all.

## Phase 1 — sweep
Three queries per anchor: `bridal hair and makeup near {anchor}`, `wedding makeup artist near {anchor}`, `wedding hair stylist near {anchor}` (place_id dedup collapses the overlap for free); statewide launches add the three `... in {StateName}` variants. All encoded in `TYPE_PROFILES.beauty`.

Noise is handled mechanically: the sweep drops nail/barber/med-spa/tanning/waxing/tattoo/microblading/beauty-school/wig names **unconditionally**, and prunes other-vendor-type names via the cross-type guard — bridal **dress** shops are the big one here (the "bridal hair and makeup" query pulls them in), plus photographers, planners, and florists. An own-trade word rescues a hybrid ("Blush Bridal Boutique" prunes; "Blush Bridal Beauty" stays). Then the **bridal-intent check** (mandatory):
```
node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs data/launchvendors/<slug> --type hairmakeup
```
Keeps a sweep row when its name, website homepage, or **Google reviews** show `wedding | bridal | bride` evidence; an everyday hair or makeup salon with no bridal evidence anywhere is **pruned automatically** to `pruned.csv` (relay the names; rescue by moving a row back). Only `WED_UNVERIFIED` rows (site we couldn't read, no rescuing reviews) still need a glance. Research-sourced rows are exempt (their sources are wedding-scoped).

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} wedding hair and makeup`
- `best bridal makeup artists {region}` / `best bridal hair stylists {region}`
- `{region} mobile bridal hair and makeup` / `on-location bridal hair and makeup {region}`
- `{region} bridal hair and makeup prices` / `{region} wedding makeup cost`
- `{region} wedding hair and makeup reddit`

Fetch-extraction prompt (substitute region/state/domain):

> List every wedding/bridal HAIR and/or MAKEUP artist, team, or salon on this page that serves {REGION}, {ST}. Include artists who do BOTH hair and makeup, and also artists who do ONLY hair or ONLY makeup. Output ONLY JSON lines, one per artist/business: {"name":"...","hint":"<their base city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","instagram":"<their Instagram handle or URL if shown, else omit>","provenance":"web:{domain}","intel":"<which services they do (hair only / makeup only / both), whether they serve the BRIDAL PARTY (bridesmaids, mothers, flower girls) or bride only, their STYLE in the words the page uses (natural/soft glam/full glam/boho/editorial/airbrush/timeless), any WEDDING pricing figures — bride hair, bride makeup, bride hair+makeup combined, per-bridesmaid/bridal-party rates, trial/preview cost, add-ons like lash strips or extensions — plus travel/on-location policy (travel fee, mileage, free within X miles, studio-only vs. they come to you, minimum party size or minimum spend, early-start fee), team size, and region served, else omit>"}. EXCLUDE nail salons, barbershops, med spas/injectables, lash-extension-only or brow-only bars, permanent-makeup/microblading studios, tanning, waxing, beauty schools, and other vendor types (photographers, planners, bridal dress shops). Capture WEDDING pricing only — ignore prom, homecoming, and other non-wedding event rates. No commentary, no markdown.

### Website + Instagram hunt (same subagent, after extraction)
This type's sites are often thin or missing and **Instagram is frequently the actual portfolio**, so the hunt matters more here than anywhere except photographers. For each candidate **missing a website OR missing an instagram handle**, run one WebSearch: `"{full name}" {ST} bridal hair makeup` — take the artist's OWN domain from the results (never a directory/social hit as `website`) and grab the Instagram handle whenever it surfaces, including from a linktree/booking page listing. Update the candidate's JSON line before appending. Cap ~20 hunt searches per agent run.

## Phase 2 — Reddit/Instagram-paste extraction prompt

> Read every `reddit-*.txt` and `ig-*.txt` file in `<abs workdir>/research/`. They are raw pastes (Reddit threads, Instagram search/hashtag pages) about wedding HAIR and MAKEUP artists near {REGION}, {ST}. Extract every distinct artist, team, or salon commenters used or recommend for wedding-day hair and/or makeup — including hair-only and makeup-only artists. EXCLUDE nail/barber/med-spa/lash-bar/permanent-makeup businesses, other vendor types, and artists clearly based in and serving another state. Append one JSON line per artist to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<city if stated, else omit>","website":"<their own website if linked, else omit>","instagram":"<handle if shown (an @mention counts), else omit>","provenance":"<reddit|ig>:<filename>","intel":"<what a commenter actually PAID (a real figure is gold — for the bride, and per bridesmaid if given), whether it was hair, makeup, or both, whether they did the bridal party, the trial/preview experience and its cost, travel fee or mileage charged and how far they came, how the look HELD UP through the day (this is the single most-repeated thing couples talk about), style words used, punctuality/professionalism, any warning, and region served, else omit>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

Instagram pages are browsed and pasted **by the user** — never fetched or automated (Meta ToS). Worth asking for here: this type lives on IG, and `#{region}bridalhair` / `#{region}makeupartist` hashtag pages surface artists no listicle names.

## Phase 4 — adjudication watchlist (your call, not Kiara's)
Beyond the standard docket, decide on:
- **Everyday hair or makeup salons** that squeaked past `wedcheck` on one incidental "wedding" mention — delete unless they show a real bridal service.
- **Bridal DRESS shops** rescued by the hybrid guard because their name carries a beauty word (e.g. "Bella Bridal Boutique & Beauty Bar") — these belong to `--type dress`, not here; delete unless they genuinely do wedding-day hair or makeup.
- **Lash / brow / permanent-makeup / med-spa businesses** whose names dodged the junk filter — delete; they aren't wedding-day glam.
- **Hair-only or makeup-only artists** — KEEP. They are in scope; note which service in `intel`.
- **Bride-only artists** (no bridal-party service) — KEEP, note the limitation.
- Name-variant dedup collisions (the profile treats "Jane Doe Makeup Artistry" ≡ "Jane Doe Beauty" — the dry-run's name+city skip list shows what collided).

## Enrichment handoff (recon guidelines)
Archive into `intel` now; the enrichment pass consumes it:
- **Services offered** — hair, makeup, or both; and **who they serve**: bride only vs. the full bridal party (bridesmaids, mothers of the bride/groom, flower girls). This is the first thing a couple checks.
- **Where they serve** — becomes `service_region` on every recon entry, **required**. Mobile artists' stated travel radius is the best source; a studio's city/metro is an acceptable sourced fallback.
- **Travel policy — capture the shape, not just a number.** Do they come to you? Free within X miles / the metro, then a fee or mileage past it? Free only if you come to their studio? Is there a minimum party size or minimum spend for on-location service, or an early-start fee for a pre-dawn call time? Couples get surprised by exactly this, so it's high-value.
- **Pricing packages — this type usually POSTS them, so go find the numbers.** Bridal sites commonly list bride hair, bride makeup, bride hair+makeup combined, per-person bridal-party rates (often split hair vs. makeup), the trial/preview fee, and add-ons (lash strips/extensions, hair extensions installation, veil placement, touch-up kits, an artist staying for touch-ups). **Wedding/bridal pricing only** — ignore prom, homecoming, and general-event rate cards. Never invent a number.
- **Style** — in the artist's own words and in couples' words: natural / soft glam / full glam / boho / editorial / classic-timeless / airbrush vs. traditional foundation. Note range of skin tones and hair textures they show work on when a source says so.
- **Human anecdotes are the single most valuable content for this type.** A bride's own account beats any posted rate card — what she paid, whether the trial matched the day, whether the look **held up through humidity, tears, and dancing**, whether the artist ran on time with a whole party to get through, how they handled a nervous or unhappy bridesmaid. Capture these verbatim-ish into `intel` and attribute the source.
- **Photos:** 2–3 close-up shots of brides or bridal-party members where the hair/makeup is the subject (see enrich `references/hairmakeup/photo-rules.md`).
