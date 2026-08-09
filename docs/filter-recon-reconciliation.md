# Reconciling `vendors.filters` with recon entries

**Handoff brief.** Written 2026-08-08 by a session that could not execute it: this
container has no Supabase or Batch API credentials (`.env.local` is empty because
the environment secrets are unset). Everything below is the ask plus the context
needed to do it. Whoever picks this up needs `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_BATCH_API_KEY` (see
`.claude/hooks/session-start.sh`).

---

## 1. The ask (Kiara, 2026-08-08)

Two stores describe the same vendor and they disagree. Bring them into
agreement, **for every filter attribute across every vendor type** — not just
pricing, not just venues.

**Direction A — filters have it, recon does not.**
Where `vendors.filters` records an attribute that no recon entry on that vendor
mentions, **edit an existing bot recon entry, or create a new one**, so the
recon documents it. Brief is fine: a short clause outlining the key information.

**Direction B — recon has it, filters do not.**
Where a recon entry states a fact that belongs in `vendors.filters` and the tag
is absent, **set the tag — if and only if it is valid and appropriate.**

### The rule this is enforcing

> Tag as many filter tags as possible, and vendor entries should always document
> ALL valid tags found during research. What recon contains should be equivalent
> to what the filter tags contain.

### One hard constraint, stated explicitly

> **Do NOT trust regex to do this.**

Every keep/skip/write decision is a judgment call and must be made by a model
reading the vendor's actual recon text against its actual attributes. Regex is
acceptable *only* for mechanical plumbing that never decides anything — parsing
JSON, listing which keys are present, chunking batches. It must never decide
whether a fact is "documented", whether a tag is "supported", or what value to
write.

This is not a style preference. The whole reason the two stores drifted is that
each was populated by a different mechanical pass, and a third mechanical pass
would produce a third disagreeing store.

---

## 2. What is measured so far

Run against the hosted DB on 2026-08-07, **price attribute only**, Colorado bbox:

| | count |
|---|---|
| `has_price` true but no money figure in any recon entry | **156** |
| money figure in recon but `has_price` false | **170** |

That is one attribute. The corpus carries **10,962 populated attribute values
across 2,163 vendors** (5.1 per vendor), so the full job is roughly an order of
magnitude larger in each direction. Per-type shape, from
`data/filter-extraction/vendor-filters.jsonl`:

| type | vendors | populated values | avg/vendor |
|---|---|---|---|
| venue | 679 | 4,354 | 6.4 |
| photos | 274 | 1,730 | 6.3 |
| hotel | 253 | 691 | 2.7 |
| flowers | 183 | 601 | 3.3 |
| beauty | 183 | 953 | 5.2 |
| food | 182 | 750 | 4.1 |
| planner | 148 | 704 | 4.8 |
| band | 119 | 457 | 3.8 |
| dj | 77 | 292 | 3.8 |
| dress | 65 | 430 | 6.6 |

**That JSONL is a snapshot (2026-08-01), not live.** It is committed and useful
for planning, cost estimates and offline testing, but the run must read
`vendors.filters` from the DB.

Reproduce the price measurement (and adapt per attribute):

```sql
select
  count(*) filter (where has_price and not recon_has_money) as filters_only,
  count(*) filter (where not has_price and recon_has_money) as recon_only,
  count(*) as total
from (
  select b.has_price,
         exists (
           select 1 from recon_entries r
           where r.vendor_id = b.id and r.status = 'active'
             and (coalesce(r.price_text,'') || ' ' || coalesce(r.price_details,''))
                 ~* '\$[[:space:]]*[0-9]|[0-9][[:space:]]*\$|[0-9][[:space:]]*(dollars|usd)'
         ) as recon_has_money
  from vendors_in_bbox(-109.1, 36.9, -102.0, 41.1, null, 5000) b
) t;
```

Note the regex there is a *measurement* of scale, not a decision procedure. Do
not reuse it to pick rows to edit.

---

## 3. Where everything lives

### `vendors.filters` — jsonb, migration `0032`
- Keys are per vendor type. **The definitions are
  `lib/constants/vendor-filters.ts` (`VENDOR_FILTERS`)** — the single source of
  truth for keys, kinds (`multi` / `bool` / `range`), and the **allowed option
  values** for every `multi`. A value not in that list is invalid; the UI will
  never offer it and the matcher will never match it.
- Companion columns: `filters_source` (`extraction` | `recon` | `manual`),
  `filters_updated_at`.
- Attribute counts per type: venue 7, photos 8, beauty 7, food 6, flowers 6,
  band 6, dress 6, dj 5, hotel 5, planner 4.
- Price is not one key. It is a cluster: `price_min`, `price_max`,
  `price_basis`, `price_kind`, `price_confidence`, `price_quote` (verbatim
  evidence), `price_tiers[]` — and for beauty, `bride_price_*` /
  `party_price_*` / `trial_price`. Read `vendor-filters.ts` before writing any
  of it.

### `recon_entries` — migration `0001`, plus `0008`/`0009`/`0028`
Relevant columns: `vendor_id`, `author_id`, `recon_type`, `price_text`,
`price_details`, `notes`, `service_region`, `status`,
`recon_collected_month` / `recon_collected_year`, `created_at`, `updated_at`.

### Bot identities
`profiles.is_bot = true`. **Read them from the DB.** `CLAUDE.md` points at
per-state rosters in `data/enrichvenues/rosters/`, but `/data/enrichvenues/` is
gitignored — those files exist only on the machine that ran enrich and will not
be in a fresh checkout.

### Prior art to read before starting
- `.claude/skills/enrichvendors/references/common/entry-rules-core.md` — the
  drafting contract these entries must continue to satisfy.
- `.claude/skills/enrichvendors/scripts/upload.mjs` — the prose gates (§5).
- `supabase/migrations/0036_reword_quote_only.sql` — the closest precedent for a
  bulk edit of existing bot recon: how it gated on `is_bot`, and how it split
  mechanical repair from editorial judgment.
- `docs/vendor-filter-coverage.md` — per-attribute coverage and the "two kinds
  of missing data" framing.

---

## 4. Hard rules

These are the ones that cause real damage if broken. Roughly in order of how bad
it is to get wrong.

1. **Silence is not a negative. Never write `false` (or an empty array) to mean
   "we don't know".** This is the single biggest risk in Direction B. The
   matcher (`lib/filters/match.ts`) treats a missing key as *unknown* and
   demotes the vendor into the partial tier, but treats an explicit `false` as a
   **contradiction** and removes it from the map entirely. Writing a negative you
   cannot support therefore deletes a real candidate. Only ever write a value
   you have positive evidence for; leave the key absent otherwise. (This is why
   the `rare`-filter exclusion rule was removed on 2026-08-06 — see `CLAUDE.md`,
   "Silence NEVER excludes".)

2. **Only ever edit or author recon under a bot account.** A real person's entry
   is their own words and must never be rewritten — the same line migration
   `0036` drew with its `profiles.is_bot` gate. Check the author, not the
   content.

3. **One entry per (vendor, author).** `0028` adds a partial unique index on
   `(vendor_id, author_id) where status <> 'removed'`. Creating a new entry
   requires a bot that does **not** already have one on that vendor; otherwise
   edit the existing entry. An upload that ignores this fails the index rather
   than silently duplicating — which is the desired behaviour, but plan for it.

4. **Never clobber `filters_source = 'manual'`.** Precedence is manual > recon >
   extraction. Writes made from recon should set `filters_source = 'recon'` and
   `filters_updated_at`, and must skip any row already marked `manual`.

5. **All recon text must pass the existing prose gates** in
   `upload.mjs` — they are there because each one caught a real defect that
   reached production:
   - `BANNED` — marketing/AI filler ("stunning", "nestled", "boasts").
   - `PROCESS` — pipeline self-reference ("batch", "dossier", "seeded", "bots").
   - `RESEARCH` — research-artifact narration ("404", "site didn't load",
     "reviews go back to 2020-2023"). Say what is true of the *vendor*.
   - `EMDASH` — no em/en dashes anywhere; real users type hyphens.
   - `QUOTE_ONLY` + `MONEY` — the retired "Quote only" sentinel; a quote-only
     phrase next to an actual figure is a hard failure, not a repair.
   - Literal `\n` escapes are **repaired** at insert, not rejected.
   Run `pipeline.mjs status`-equivalent checks *before* writing, not after.

6. **Do not make the corpus read as templated.** Appending the same sentence
   shape to 2,000 entries is the failure mode that makes a page of recon read as
   machine-written. Vary phrasing; write in the voice of the entry being edited.
   This is why Direction A says "brief", not "uniform".

7. **`service_region` is required on service-area types and forbidden on
   fixed-location ones** (`venue`, `hotel`, `dress` — `FIXED_LOCATION_TYPES` in
   `lib/constants/categories.ts`). Any newly created entry must respect this.

8. **US spelling, no em dashes, plain wording.** Consistent with the landing-page
   and drafting rules.

---

## 5. Judgment guidance

### Direction A (filters → recon)

The bar is *did a couple reading this vendor's recon learn this fact*. Not
whether the exact word appears — a note saying "they let you bring your own
caterer" documents `catering_policy: ["outside_allowed"]` perfectly well, and no
edit is needed.

Prefer **editing an existing bot entry** over creating one: it keeps the entry
count honest and avoids the `0028` collision. Create a new entry only when the
vendor has no bot entry at all, or when the existing ones are so full that
appending would distort them.

Where an attribute is genuinely uninteresting to a couple in prose, it is
acceptable to leave it undocumented and say so in the run report rather than
padding the entry. Flag the pattern rather than inventing sentences.

### Direction B (recon → filters)

"Valid and appropriate" means all of:
- The recon states the fact **explicitly**, not by implication.
- The value maps onto an **allowed option** in `VENDOR_FILTERS` for that type.
- It is **positive** evidence (see hard rule 1).
- For prices: the number is the vendor's own rate, and you can determine
  `price_basis` (per-person vs package vs per-night …) and `price_kind`
  (range / starting_at / single_figure). A number you cannot place on a basis is
  worse than no number, because the matcher will compare it on the wrong axis.
  Set `price_confidence` honestly (`published` / `listing` / `inferred`) and put
  the supporting text in `price_quote`.

When in doubt, **skip and report**. A missing tag demotes; a wrong tag excludes
or misprices.

---

## 6. Suggested execution shape

Not prescriptive, but this mirrors the pipeline the repo already trusts
(`/enrichvendors`), and reusing it means reusing its gates:

1. **Export** — per vendor: `id`, `name`, `vendor_type`, `city`, `filters`,
   `filters_source`, and every `status = 'active'` recon entry with its
   `author_id` and `is_bot` flag.
2. **Adjudicate** — one model call per vendor (batched), given the vendor's
   attributes, its type's `VENDOR_FILTERS` definitions **including allowed
   option values**, and its full recon text. Ask for both directions in one
   structured response: recon edits/creations, and proposed filter writes with
   evidence quoted from the recon. Use the metered Batch API
   (`ANTHROPIC_BATCH_API_KEY`) exactly as
   `.claude/skills/enrichvendors/scripts/draft.mjs` does — see
   `docs/anthropic-batch-drafting.md`.
3. **Gate** — run the prose gates and a filter-value validator (every proposed
   value must exist in `VENDOR_FILTERS`) over the results. Dry-run report by
   type: how many edits, creations, tag writes, skips.
4. **Apply** — behind an explicit flag, resumable, with `filters_source =
   'recon'` on filter writes and `updated_at` set on edited entries.

**Pilot on one vendor type first** (`dress` is the smallest at 65 vendors, or
`planner` at 148 for something more representative). Read a sample of the
proposed output by hand before running the other nine. This is a bulk mutation
of user-visible content driven by model judgment; there is no cheap undo.

**Cost**: full drafting runs ~$1–1.50 per 300 vendors on the Batch API, so all
2,163 vendors is roughly $7–11 for a drafting-weight pass. Reconciliation output
is shorter, so expect less. Not a constraint — but `--max-cost` gating is
already the convention in `draft.mjs`, so keep it.

---

## 7. Verifying it worked

- Re-run the §2 query. `filters_only` and `recon_only` should both fall sharply.
  They will not reach zero, and should not: some attributes are legitimately not
  worth prose, and some recon statements are legitimately too vague to tag.
- Spot-check that no vendor gained an explicit `false` it cannot support
  (`select count(*) from vendors where filters_source = 'recon'` then read a
  sample).
- Confirm the Explore list order moved as expected: `has_price` in migration
  `0035` reads `vendors.filters`, so Direction B directly changes which vendors
  sort into the priced tier. That is the point, but it means the map and list
  will visibly shift.
- Re-run `node scripts/test-filter-match.mjs` (53 tests) — it does not touch
  this data, but it is the guard on the matching rules if any of them are
  touched along the way.

---

## 8. Deferred: codify the rule in the skills

Explicitly a **second step, after** the reconciliation above (Kiara, 2026-08-08).
Once the corpus is consistent, encode the invariant so it stays that way:

- `/launchvendors` and `/enrichvendors` should tag as many filter attributes as
  the research supports.
- Recon entries should document **all** valid tags found during research.
- The two stores should be equivalent by construction, not by periodic repair.

Touch points: `.claude/skills/enrichvendors/references/common/entry-rules-core.md`
and `draft-contract.md`, the per-type cards under `references/<type>/`, and the
`pipeline.mjs status` pre-check (which is where a "documented what you tagged"
assertion would naturally live, alongside the existing prose gates).
