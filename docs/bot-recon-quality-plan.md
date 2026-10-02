# Bot recon quality: remediation plan

Status: **PLAN, not run** (2026-10-02). Source: the 27-vendor pilot review in `data/qualitypass/pilot/` (164 flags, verification pass in progress) plus corpus-wide counts from the 2026-10-02 read-only export (3,386 active bot entries on 2,084 vendors).

Principle: fix each defect **at the stage that produced it** (so the next enrich/reconcile run cannot reintroduce it), then **remediate the live corpus**, then run the **full judgment review** over what remains. Nothing is written to the DB until Kiara has reviewed the proposed change list for that issue.

## Ground rules for every write in this plan

- **Snapshot before writing.** `recon_entries` keeps no history (`scripts/reconcile/README.md`). Every apply step exports the rows it will touch to `data/qualitypass/<step>/snapshot/` and ships a matching restore. A step with no snapshot does not run.
- **Bot rows only.** Every UPDATE/DELETE is gated on `profiles.is_bot`; a real person's words are never edited.
- **Per-edit audit log** (entry id, field, old, new, evidence, reason) kept under `data/qualitypass/`, so a later reviewer can trace every sentence. This is exactly what the 2026-08-09 reconcile run did not leave behind.
- **Gates in lockstep.** Any new prose gate lands in `pipeline.mjs status`, `upload.mjs`, and `scripts/reconcile/prose-gate.mjs` together.

## Issues

Scale = corpus-wide count where it is mechanically countable; otherwise the pilot rate.

### 1. Post-draft prose edits by the filter reconciliation pass
- **What:** 1,301 live entries have `updated_at` set (1,118 on 2026-08-09, 158 on 08-11, 25 later). 1,269 contain sentences that appear in no draft CSV. Pilot: several are false ("walk-ins welcome", "full planning is her main tier", "spots don't cost anything") and one rewrote a price headline into a self-contradiction (Et Voila).
- **Cause:** Direction A of `docs/filter-recon-reconciliation.md` (filters -> prose) wrote a sentence to back each tag. The tag came first; the sentence was written to match it, sometimes with no source. The main run's work dir and snapshot are gone (worktree deleted), so there is no undo file.
- **Upstream fix:** reconcile may only append a fact that carries a verbatim evidence quote from a harvested source page (not from the tag itself); run the full prose gates; persist the audit log + snapshot outside any worktree. `filter-recon-daily.yml` is PAUSED for the whole cleanup (Kiara, 2026-10-02); see the final step of the Sequence.
- **Remediation:** rebuild each edited entry's pre-edit text from the draft CSVs/worker JSONLs (`data/qualitypass/live-vs-draft-drift.json` already isolates the added sentences). For every added sentence, an agent checks it against the filter-extraction evidence (`data/filter-extraction/vendor-filters.jsonl`, `data/enrichvendors/filterpass-*/research/`) and the live site: **keep / reword / drop**. Where a sentence is dropped, the tag it backed is dropped too unless independently sourced. Output is a change list for review, then a snapshot-backed apply.

### 2. Collected dates earlier than the sources they cite
- **What:** in the pilot, most vendors had an entry dated before a review or event it quotes (e.g. a 4/2025 card citing "a recent review from may 2026"). Plus sibling entries sharing one date (Petal and Bean).
- **Cause:** `pipeline.mjs` (line ~282) assigns a hashed 1-18-months-back date before drafting, blind to source dates; the contract's "a real source date wins" is left to the drafter, who rarely applies it.
- **Upstream fix:** assign or validate the date AFTER drafting: floor = the newest dated source the entry actually uses (harvested reviews carry `when: YYYY-MM`), ceiling = harvest month. `pipeline.mjs status` hard-fails a violation. Keep the sibling-distinct rule.
- **Remediation:** mechanical candidate sweep (match each entry's quoted/paraphrased review text to `harvest.json` reviews, compare months), then move flagged dates forward to the floor, keeping siblings distinct. `created_at` is re-backdated inside the new month the same way upload does, so ordering stays sane. Cheap; no web.

### 3. Broken "watch-outs" extractor
- **What:** dossiers label positive quotes as "sourced negatives" ("I wish I'd have stayed longer!"). The contract REQUIRES one watch-out to land in the notes, so drafters either carry a garbled negative or soften a real one.
- **Cause:** `dossier.mjs` lines ~182-199: any review rated <=4 stars qualifies, and the CAVEAT regex fires on bare `but` / `however` / `wish`.
- **Upstream fix:** <=3 stars, or a sentence that is actually negative (classify it, not regex it); drop the bare-conjunction triggers; label the section honestly and allow it to be empty.
- **Remediation:** handled inside the full review pass (item 18): every entry's negative claims are checked against sources, and real watch-outs that were missed are flagged.

### 4. Dossier compression drops the most useful facts
- **What:** fee tables, wedding/private-event pages, price tiers and full review quotes were cut (Red Rocks weddings program, d'Anelli price tiers, Colorado Bridal fees, McArthur's "cut off" quote). Several high flags trace here.
- **Cause:** `dossier.mjs`: price lines must match `PRICE_LINE` and be <=300 chars with a 1,500-char budget; filter facts 1,200 chars; reviews cut at 400 chars mid-sentence; reddit 900 chars; whole dossier capped at 4,000 chars.
- **Upstream fix:** keep pricing tables and wedding/event pages whole, cut reviews at sentence boundaries, raise the cap (drafting is batch-priced, so the cost is small), and mark any truncation explicitly so a drafter never treats a truncated source as complete.
- **Remediation:** re-run `dossier.mjs` on existing harvests (free, no Places calls), diff the new dossiers against the old ones per vendor, and route vendors where the new dossier contains a price / wedding offering / policy that the live entries contradict or omit into the review pass at high priority.

### 5. Tooling language leaking onto public cards
- **What:** about 121 live entries contain phrases like "site wouldn't load for me", "kept 403ing", "the site's a no-go", "crawled to a different ...".
- **Cause:** the `RESEARCH`/`PROCESS` gates miss these phrasings, and at least one leak ("crawled") came through a path that did not run the gates.
- **Upstream fix:** extend the gates (in all three places) and make every write path call them, including reconcile and any one-off SQL.
- **Remediation:** these claims are usually ALSO false (the site works, or has pricing), so each one gets a site re-check, then a rewrite to what is true of the vendor, or removal of the clause.

### 6. False "nothing exists" claims from missing or failed websites
- **What:** "no pricing posted anywhere", "nothing says they do weddings", "not a wedding venue", written when the crawl failed or the row had no website. 280 of 2,084 vendors have no `website`.
- **Upstream fix:** resolve the website before harvest (Places `websiteUri` is already in harvest; add a web-search fallback and wedding subsites); the contract forbids absence claims ("anywhere", "no pricing exists") unless a site was actually read, and `SITE CRAWL FAILED` dossiers may not assert absence at all.
- **Remediation:** find websites for the 280, re-harvest site pages only (free, no Places), re-dossier, and review those vendors' entries first.

### 7. Wrong business, wrong website, relocated, renamed
- **What:** Fairmount Cemetery points at a cemetery in Newark, NJ; Zack Weld moved to Atlanta; Colorado Photography Squad has the wrong name. Three in 27 vendors.
- **Upstream fix:** an identity check after harvest: the site's state/address/phone must be consistent with the row (Colorado, plausible city); a mismatch blocks drafting for that vendor.
- **Remediation:** corpus-wide candidate sweep over the existing harvested pages (out-of-state addresses, non-CO area codes, "based in <other state>", a domain shared with an unrelated business), then judgment review. Proposed actions: fix the website/name, or remove the vendor and its entries.

### 8. Wrong vendor type
- **What:** a 2-room B&B with no wedding offering listed as a venue; hotels with real event programs (Urban Cowboy, Embassy Suites Loveland) typed `hotel`; Red Rocks entry says it is not a wedding venue.
- **Fix:** these are Kiara's per-property calls under the hotel/venue rule in `CLAUDE.md`. The review pass produces a short decision list with the evidence; nothing is retyped automatically.

### 9. Price errors: units, omissions, stale figures
- **What:** bride-only price shown as group price, elopement price applied to all tiers, livestream add-ons presented as photo add-ons, published fee tables summarized as "call for quote", prices that changed since harvest.
- **Upstream fix:** mostly items 4 and 6 (the drafter never saw the right data). Add a type-rule line: every figure states what it buys (who, how long, which tier).
- **Remediation:** the review pass (item 18) with the stale-vs-wrong distinction recorded per flag.

### 10. Photos that are not the vendor's work
- **What:** stock images (template photos, an iStock image), other bands' photos from a shared agency site, a photographer's own headshot, Newark headstones. 650 entries carry 1,232 photos.
- **Cause:** `photos.mjs` picks from every image on the crawled site and records only the image URL, not the page it came from.
- **Upstream fix:** record the source PAGE per photo; prefer the vendor's own gallery/portfolio pages; reject stock-catalog filenames and known stock hosts; on agency/multi-act sites only use the act's own page.
- **Remediation:** a vision pass over all 1,232 photos (with each photo's source URL and the vendor's name/type): keep / remove, with a reason. Removals go to Kiara as a list, then a snapshot-backed delete of the `recon_media` rows (service role; storage objects removed after).

### 11. Duplicate and overlapping entries on one vendor
- **What:** sibling entries retelling the same anecdote or restating one source; 37 vendors carry 4+ bot entries (36 with 4, one with 6) although the drafting cap is 3; the supplementary pass drafted a second entry without seeing the first.
- **Upstream fix:** the supplementary pass call file includes the vendor's existing live entries and must add NEW facts or write nothing; the 3-entry cap is checked against live counts, not just the run.
- **Remediation:** every multi-entry vendor gets a duplicate check in the review pass; proposed merges/removals go to Kiara.

### 12. Thin templated entries from reconcile "creates"
- **What:** 138 entries created 2026-08-09 by `scripts/reconcile/build-creates.mjs` for tag-only vendors, in a third-person template ("X offers hair services in studio and works with textured hair."), 30 of them near-identical across vendors.
- **Proposed:** either remove them, or re-draft those vendors through the normal enrich pipeline (with the fixes above). **Kiara's call.** Upstream: `build-creates` should not exist as a separate voice-less writer; route creations through the enrich drafter.

### 13. Missing `service_region` on service-area entries
- **What:** 185 entries for service-area types have no region (required by the contract), mostly from the supplementary and reconcile-create paths, which skipped the gate.
- **Fix:** gate both paths; fill the 185 from the vendor's site/research (and flag where the region a sibling entry states is too narrow, item 14).

### 14. Service regions narrower than where the vendor works
- **What:** "Boulder area" for a Denver-plus-destination team, "Breckenridge area" for Breck/Keystone/Vail. Pilot: 9 flags in 27 vendors.
- **Fix:** review pass; type rules get a line saying to state the vendor's own stated coverage.

### 15. Filter tags that are wrong, unsupported, or not in the prose
- **What:** tags re-extracted 2026-08-05 from newer harvests now hold facts the prose lacks; chain-brand-level tags applied to a property (Marriott/Hilton `block_type: guaranteed` from a brand reddit comment); a tag contradicted by the site (`appointment_required: false`).
- **Fix:** a mechanical tag-vs-prose consistency sweep (the upload gate's rule, re-run on live data), then each failure is resolved by sourcing the fact into prose or dropping the tag. Brand-level facts may not set property tags. Tags whose backing sentence was dropped in item 1 go too.

### 16. Vendors with no location (71 vendors, 106 entries)
- **What:** invisible on the map and in search; the pilot found both sampled ones have live websites missing from the row, and one has the wrong name.
- **Fix:** include them fully in the review pass (as agreed); add website + city/location from research as part of their fix list. Upstream: `upload.mjs` rejects a location-less row.

### 17. Misattribution and conflated sources
- **What:** two separate reviews merged into "the same review", a press list read as a price source ("Rocky Mountain Bride guide"), a national 15-city page read as a Denver relationship.
- **Upstream fix:** the dossier labels every review/source with an id + date so a drafter cannot blur them; the contract requires each anecdote to name one source.
- **Remediation:** review pass.

### 17b. Cross-vendor contamination inside a draft call file (found in verification)
- **What:** a fact from one shop's review ("1970s", Donna Beth's) landed in a different vendor's entry that shared the same call file (`drafts/d1-call-02.md`). And a review the dossier cut at "There is no ..." was completed by the drafter with an invented clause.
- **Upstream fix:** every dossier fact in a call file carries its vendor slug; `pipeline.mjs status` checks each entry's distinctive phrases against its OWN dossier and fails on a match found only in a sibling vendor's block. Truncated quotes are never handed to a drafter (item 4).
- **Remediation:** the same phrase-provenance check run over all live entries vs their call files gives a candidate list for the review pass.

### 18. The full judgment review pass (what remains after 1-17)
Runs after the mechanical sweeps and re-dossiers, so reviewers spend their judgment on what scripts cannot see. Changes from the pilot:
- **Packets add:** the original draft text with reconcile-added sentences marked; the filterpass research pages; the launch research and provenance; the old-vs-new dossier diff; a live-photo -> local-file mapping with source URLs.
- **Fixed category list** (about 15, replacing the 89 ad-hoc labels): `wrong-business`, `wrong-type`, `false-claim`, `unsupported-claim`, `unit-error`, `omitted-fact`, `stale`, `date`, `duplicate`, `misattribution`, `tooling-leak`, `bad-photo`, `wrong-filter`, `service-region`, `vendor-row` (website/name/address/location), `other`.
- **Brief rulings:** a third-party price that exists but was not harvested is `omitted-fact` (low unless it changes the budget picture); a stale fact repeated across entries is ONE flag per vendor listing the entry ids; fetching with a browser user agent via curl is allowed when WebFetch is blocked (no Meta).
- **Every reviewer and verifier pinned to Opus.** Every high/med flag goes through an adversarial verifier before it reaches the CSV.
- **Order:** vendors routed by items 4-7 first (highest yield), then by type.
- **Cost:** pilot was ~31k reviewer tokens per vendor; ~65M tokens for all 2,084 before verification. The mechanical sweeps (2, 5, 13, 15, dupes, identity) are near-free and shrink what the review has to find.

## Sequence

1. **Kiara rulings** (below).
2. **Upstream pipeline fixes** (items 1-7, 10-13, 15-17): code + `npm test` + a re-run of `pipeline.mjs status` on an old workdir to show the new gates catch the pilot's defects. One PR.
3. **Mechanical sweeps** over the live export -> candidate lists (items 2, 5, 7, 11, 13, 15, 16).
4. **Re-harvest site pages / re-dossier** (items 4, 6). No Places calls, so $0 in Google spend.
5. **Remediation change lists** for items 1, 2, 5, 10, 12, 13, 15: Kiara reviews each list -> snapshot-backed apply.
6. **Full review pass** (item 18) -> verified `flags.csv` -> Kiara decides -> snapshot-backed apply.
7. Re-export and re-run the sweeps to confirm the counts went to zero.
8. **Turn `filter-recon-daily` back on** (paused 2026-10-02 for this cleanup): uncomment the `schedule:` block in `.github/workflows/filter-recon-daily.yml` AND run `gh workflow enable filter-recon-daily.yml`, then remove the PAUSED line from CLAUDE.md "Known outstanding". Watch the first run's report artifact: it is the first run under the new evidence rules.

## Rulings (Kiara, 2026-10-02)

1. **Thin reconcile-created entries (item 12): remove for now.**
2. **Date fixes (item 2): move collected dates forward automatically** when the floor is mechanical.
3. **Photos (item 10): delete the ones that fail.** The test is not "did the vendor take it" but "does it purport to show the vendor or its work product". A guest's photo of a venue is fine; a stock bride on a photographer's card, another band on a band's card, or headstones from a different cemetery are not.
4. **Bot-entry cap (item 11): at most 3 BOT entries per vendor** (real users' entries do not count toward it), going forward and by trimming existing vendors over the cap.
5. **Reconcile-added sentences (item 1):** (A) a real source confirms it: keep sentence and tag. (B) a source contradicts it: replace BOTH the sentence and the tag with the true fact. (C) unconfirmable either way: remove the sentence AND the tag.

## Progress log

- **2026-10-02** Pipeline fixes merged (PR #61). `filter-recon-daily` paused (PR #63 + Actions UI; resume = step 8, issue #62).
- **2026-10-02** Item 12 applied: 138 thin reconcile-created entries set `status: removed` (soft delete). Undo: `restore.mjs --work qualitypass-12-remove-thin-entries --run 20261002T215815-qualitypass-apply-9638d8 --apply`. All 138 were the vendors' only bot entries, so those 138 vendors have no recon again and are re-enrich candidates.
- **2026-10-02** Item 2 applied: 956 collected dates moved forward to the newest source each entry quotes (median 7 months; 1 shares a sibling month). Undo: `restore.mjs --work qualitypass-02-date-moves --run 20261002T215952-qualitypass-apply-37dde4 --apply`. `created_at` was not re-backdated (it is only the within-month tiebreak).
- **2026-10-02** Sweep (`scripts/qualitypass/sweep.mjs`) over the post-removal export: 1,626 of 1,946 vendors / 2,007 of 3,248 entries carry a detected issue (added-after-drafting 1,282 entries, absence claims on unread sites 901, tooling language 385, missing service_region 103, price contradictions 57, over the bot cap 37 vendors, contamination 28, identity failures 8). Fix-pass pilot on 24 vendors in progress.

Tooling: every cleanup write goes through `scripts/qualitypass/apply-changes.mjs` (bot rows only, compare-and-set against a fresh read, shared prose gates, snapshot + audit via `scripts/reconcile/audit.mjs`; undo with `scripts/reconcile/restore.mjs --work qualitypass-<list> --run <id>`). Working files (exports, change lists, packets) live in the gitignored `data/qualitypass/`.
