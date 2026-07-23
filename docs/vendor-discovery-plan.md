# Vendor Discovery — spec & implementation plan

Status: **approved direction; a first slice shipped** (Kiara, 2026-07-23). The
vendor-find slice of the unified search bar (Phase A, §7) is in production — see
"Shipped early" there. Everything else below is still the reference for the
remaining discovery/search workstream: what we're building, why, the data model,
and a phased plan concrete enough for an agent to execute phase by phase.

## 1. Problem

The vendor database and recon corpus are strong and growing, but the product hasn't
made it meaningfully faster to go from "sea of pins" to "vendors that fit *my*
wedding." Explore is map + type chips only; every decision-relevant fact (price,
capacity, style, setting, quality) is trapped in free text (`price_text`,
`price_details`, `notes`), so nothing can be filtered, sorted, ranked, or searched
by the things couples actually shop on.

## 2. Design decisions (locked in — do not re-litigate without Kiara)

These came out of the 2026-07-23 design discussion:

1. **Scoring over filtering.** Search and discovery *rank and label*, never
   silently exclude. A barn venue that's over budget, or has no quote yet, still
   surfaces — with the reason visible ("~$12–18k · above your budget", "No quotes
   yet"). Hard SQL filters are for the user-driven chip UI only, and even there
   prefer sort-to-bottom over hide where feasible.
2. **Price is a set of observations, not a canonical fact.** Each recon entry
   yields zero+ price observations `{low, high, unit, context}`. Conflicting recon
   (one entry "$5–10k low tier", another "$10–15k upper tier") is *signal about a
   distribution*, not a conflict to resolve. Never collapse to one number at write
   time; aggregate at read time.
3. **Extraction unit = recon entry, not vendor.** New recon (user- or
   bot-authored) triggers incremental extraction; vendor-level facets are rollups
   over entry-level extractions. This makes facets self-updating and re-runnable.
4. **Controlled vocabulary only for enumerable physical facts** (setting,
   indoor/outdoor, capacity, price unit). Open/stylistic language ("moody",
   "EDM", "intimate") is served by full-text search now and embeddings later —
   we do not try to predict user vocabulary. **Log every search query** from the
   first search feature shipped; the query log is how we learn real vocabulary
   and decide which terms get promoted to first-class facets.
5. **Popularity is Reddit-primary, Google-prior.** Independent positive mentions
   in wedding subreddits are the most compelling signal we have. Google
   rating×volume is a general-quality prior, *gated by wedding evidence* (the
   Costco problem: huge review count, near-zero wedding relevance). Store score
   components, compute the badge from a tunable formula.
6. **Negativity: sourced only, never synthesized.** Draft rules already require
   including sourced warts; the positivity skew is structural (Places API caps at
   5 "most relevant" reviews; websites/listicles are promotional). Fix at
   harvest/dossier level (watch-outs), not by inventing balance. Bot-published
   invented criticism of real businesses is a defamation-shaped risk; inline
   attribution ("a bride on reddit said…") stays mandatory for negatives.
7. **One search bar.** The Explore bar becomes a blended input (areas + vendors +
   eventually NL queries), reusing the parallel-merge pattern already proven in
   `components/add/places-combobox.tsx`. No second search box, ever.
8. **Free-tier economics hold.** Everything below runs on Supabase free tier +
   pennies of metered Anthropic usage. No new paid services.

## 3. Data model (new migrations, starting at `0018`)

All migrations idempotent, hand-applied in the Supabase SQL editor (house rules in
CLAUDE.md). Split as numbered below so phases can ship independently.

### 3.1 `recon_extractions` — raw per-entry extraction store

```sql
create table if not exists recon_extractions (
  recon_entry_id uuid primary key references recon_entries (id) on delete cascade,
  vendor_id uuid not null references vendors (id) on delete cascade,
  model text not null,            -- e.g. 'claude-haiku-4-5'
  version integer not null,       -- bump EXTRACTION_VERSION to force re-runs
  payload jsonb not null,         -- schema in §4.2
  created_at timestamptz not null default now()
);
create index if not exists recon_extractions_vendor_idx on recon_extractions (vendor_id);
```

RLS: enable, no anon/auth policies (service-role only; nothing client-facing reads
raw payloads).

### 3.2 `recon_price_obs` — typed price observations (unpacked from payloads)

```sql
create table if not exists recon_price_obs (
  id uuid primary key default gen_random_uuid(),
  recon_entry_id uuid not null references recon_entries (id) on delete cascade,
  vendor_id uuid not null references vendors (id) on delete cascade,
  low_cents bigint,               -- null = open-ended ("under 10k" → high only)
  high_cents bigint,
  unit text not null check (unit in ('event','hour','person','item','unknown')),
  context text,                   -- "upper tier, Saturday peak", "buffet, 2024"
  created_at timestamptz not null default now()
);
create index if not exists recon_price_obs_vendor_idx on recon_price_obs (vendor_id);
```

Rules: never normalize across units (an hourly rate is not an event rate); a
per-person rate can be *projected* to an event estimate at query time only when a
guest count is known (wedding profile, Phase 5). Public read is fine (derived from
public recon); write service-role only.

### 3.3 `vendor_discovery` — per-vendor rollup (the table the UI reads)

```sql
create table if not exists vendor_discovery (
  vendor_id uuid primary key references vendors (id) on delete cascade,
  tldr text,                        -- one-line summary, ≤120 chars target
  tags text[] not null default '{}',-- controlled vocab, §4.3
  capacity_max integer,
  price_low_cents bigint,           -- min(low) over 'event'-unit obs (display band)
  price_high_cents bigint,          -- max(high) over 'event'-unit obs
  price_units text[] not null default '{}', -- which units have obs ('event','person',…)
  -- popularity components (§6) — stored separately so the formula stays tunable
  reddit_pos integer not null default 0,
  reddit_neg integer not null default 0,
  g_rating numeric,                 -- internal signal only; NEVER displayed (§10)
  g_count integer,
  wedding_evidence boolean not null default false,
  popularity numeric,               -- computed by refresh fn from components
  popular boolean not null default false, -- top-decile-per-type-per-region badge
  -- search
  notes_tsv tsvector,               -- name + tags + tldr + active recon notes
  updated_at timestamptz not null default now()
);
create index if not exists vendor_discovery_tsv_idx on vendor_discovery using gin (notes_tsv);
create index if not exists vendor_discovery_tags_idx on vendor_discovery using gin (tags);
```

Public read (RLS `select` for anon+authenticated), service-role write.
`refresh_vendor_discovery(p_vendor_id uuid)` (security definer) recomputes one
vendor's row from `recon_price_obs` + extraction payloads + active recon notes;
called by the extraction jobs after writing. A `refresh_all_vendor_discovery()`
helper loops it for backfills and popularity re-ranks.

### 3.4 `search_queries` — query log (decision #4)

```sql
create table if not exists search_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,  -- null = guest
  raw_query text not null,
  parsed jsonb,                    -- null for plain FTS; parser output for AI queries
  result_count integer,
  created_at timestamptz not null default now()
);
```

RLS on, no client policies — inserts happen in route handlers via service role.
Prune with the daily `/api/health` hook if it ever grows large (same pattern as
`rate_limits`).

### 3.5 Later phases

- `0021` (Phase 4): `alter table vendor_discovery add column if not exists
  embedding vector(1024);` + `create extension if not exists vector;` + ivfflat/hnsw
  index. Dimension per chosen embedding model (Voyage `voyage-3.5-lite` — see §8).
- `0022` (Phase 5): wedding profile columns on `profiles` (region, date,
  guest_count, budget_cents, vibe_words text[]).

## 4. Extraction

### 4.1 Two paths, one contract

- **Backfill (pipeline, Batch API):** new script
  `.claude/skills/enrichvendors/scripts/extract.mjs` mirroring `draft.mjs`'s
  submit/status/collect shape (cost-gated, resumable, targeted resubmits — reuse
  its plumbing, don't rewrite it). Input: for already-enriched regions, per-vendor
  dossiers from the region workdir **plus** all active recon entries pulled from
  Supabase. Output: JSONL of per-entry payloads (+ one vendor-level record for
  dossier-only facts) → `upload-extractions.mjs` writes `recon_extractions` /
  `recon_price_obs` and calls the refresh fn. Uses `ANTHROPIC_BATCH_API_KEY`
  (existing convention — deliberately not `ANTHROPIC_API_KEY`).
- **Incremental (runtime, nightly):** route handler `app/api/cron/extract/route.ts`,
  guarded by a `CRON_SECRET` bearer check, scheduled daily (extend the existing
  keep-alive GitHub Action/Vercel cron). Service role selects active recon entries
  with no `recon_extractions` row (or `version < EXTRACTION_VERSION`), batches
  them into a few Haiku calls with a strict JSON output schema, writes rows,
  refreshes affected vendors. **Never extract inline in `createRecon`** — saving
  recon must not gain latency or a failure mode. At soft-launch volume the nightly
  sweep is at most a handful of entries (< $0.01/day). Fails open: if the key is
  missing or the model errors, entries just wait for the next run.

### 4.2 Extraction payload schema (one per recon entry)

```json
{
  "price_obs": [
    { "low": 5000, "high": 10000, "unit": "event", "context": "low tier package" }
  ],
  "tags": ["barn", "outdoor_space"],
  "capacity_max": 200,
  "watch_outs": ["a review mentioned slow email replies"],
  "sentiment": "pos" | "mixed" | "neg" | "none"
}
```

Prompt inputs: vendor name + type + the entry's `price_text`, `price_details`,
`notes`, `service_region`. Rules for the prompt: extract only what's stated
(no market-rate inference — mirrors the draft rules' no-invention stance);
amounts in whole dollars (converted to cents at write time); "under $10k" →
`{low: null, high: 10000}`; tags only from the controlled vocab (§4.3), else omit.
`EXTRACTION_VERSION` constant lives beside the prompt; bumping it re-queues
everything through the same incremental path.

### 4.3 Controlled tag vocabulary

New file `lib/constants/discovery.ts`: per-type tag lists + labels. Physical,
enumerable facts only (decision #4). Starting sets (Kiara can prune/extend):

- **venue:** barn, ballroom, garden, mountain, industrial, historic, ranch,
  winery, brewery, rooftop, lakeside, indoor_only, outdoor_space,
  outdoor_ceremony, all_inclusive, byo_vendors, lodging_onsite
- **food:** buffet, plated, family_style, food_truck, bbq, mexican, italian,
  vegan_friendly, bar_service, staffing_included
- **music:** dj, live_band, solo_acoustic, string_quartet, mc_services,
  edm, country, latin, lighting_included
- **flowers:** full_service, alacarte, dried_flowers, installations,
  budget_friendly, delivery_setup
- **photos:** documentary, editorial, film, engagement_included,
  second_shooter, videography
- dress/planner/other: start empty; add when those types get seeded.

Stylistic vocabulary ("moody", "boho") deliberately excluded — that's FTS/embedding
territory. Promote a term to a tag only when the query log (§3.4) shows demand.

## 5. Pipeline changes for negativity (watch-outs)

Skill-construction edits, no app code:

1. **`dossier.mjs`:** add a dedicated `WATCH-OUTS:` line to the dossier format —
   a targeted cut that preserves critical fragments (review sentences containing
   "but/however/only downside", sub-5★ review text, negative-valence Reddit
   fragments) so they survive the ~500-token compression instead of losing the
   space race to pricing.
2. **Region research pass (SKILL.md Phase 1):** for the region's top ~20 vendors
   by review count, add `"<vendor>" reddit` complaint/problem-flavored queries to
   the pricing-pass WebSearch list; digests land in `research/` like the pricing
   digests and flow into dossiers automatically.
3. **`entry-rules-core.md`:** strengthen "Include negatives and quirks when
   sources have them" to require that a dossier `WATCH-OUTS` line **must** be
   carried into at least one of the vendor's entries (attributed inline, as the
   rules already mandate). Add the explicit inverse guard: never manufacture a
   negative for balance; unsourced criticism is worse than none.

## 6. Popularity ("Well-loved" badge)

Components (all in `vendor_discovery`, §3.3):

- `reddit_pos` / `reddit_neg`: count of distinct positive/negative vendor mentions
  across the region's Reddit archive. Extracted during the backfill batch pass
  from the per-vendor `reddit-slice.txt` files (they already exist in enrich
  workdirs); a mention = a distinct comment recommending/warning, not a thread.
- `g_rating` / `g_count`: already captured by `harvest.mjs`
  (FieldMask includes `rating,userRatingCount`) — backfill script lifts them from
  each workdir's `harvest.json`. **Internal signal only — never render a Google
  rating in the UI** (§10).
- `wedding_evidence`: wedcheck-style boolean (wedding terms in the harvested
  reviews/site). Honest limitation: with only 5 API-visible reviews this is a
  5-sample gate, so it discounts rather than measures — which is exactly why
  Reddit dominates the formula.

Formula v1 (computed inside `refresh_vendor_discovery`, weights as SQL constants
so re-tuning = re-run refresh, no re-extraction):

```
popularity = 3.0 * ln(1 + reddit_pos)
           - 2.0 * reddit_neg
           + (case when wedding_evidence then 1.0 else 0.25 end)
             * greatest(g_rating - 4.2, 0) * ln(1 + g_count)
```

Badge: `popular = true` for the top ~10% per `vendor_type` per `region`, with an
evidence floor (`reddit_pos >= 2 OR (wedding_evidence AND g_count >= 40)`) so thin
regions don't badge on noise. UI copy: **"Well-loved"** chip (heart icon, category
`lightHex` background) on pins' popups, list rows, and the vendor page — with a
tooltip: "Consistently recommended in wedding communities and reviews."

## 7. Search

### Phase A — unified bar: blended geocode + vendor search (no AI)

> **Shipped early (2026-07-23), ahead of Phases 1–2.** The reported Explore bug —
> typing a vendor's name or its address ("Spruce Mountain Ranch", Larkspur)
> returned nothing because the bar only geocoded *areas* and never queried
> `vendors` — didn't need the discovery stack, so a lightweight slice of this
> phase now runs in production:
> - `app/api/vendor-search/route.ts` — vendor-only autocomplete: three parallel
>   `ilike` lookups over `vendors` (**name + `address_text` + `city`**), merged,
>   deduped, ranked by the same name-relevance score as `/api/places`. No Google
>   Places call (Explore searches *our* directory; area nav stays with
>   `/api/geocode`), no `vendor_discovery`/FTS dependency, **no migration**.
> - Explore bar fetches `/api/geocode` and `/api/vendor-search` in parallel and
>   renders two groups — **Vendors** (category icon + name + address line) and
>   **Areas**. Tap area → flyTo (unchanged); tap vendor →
>   `/vendor/[id]?from=/explore`; Enter prefers an area match, else the top vendor.
>
> When Phases 1–2 land, swap the `ilike` lookup for the `search_vendors` RPC below
> (adds tags/tldr/recon-note matching + `ts_rank`); the Explore UI — grouped
> dropdown, tap-through, submit fallback — stays as-is. Query logging
> (`search_queries`) is deferred with the rest of Phase 2.

- New RPC `search_vendors(q text, p_types vendor_type[] default null, max_rows int
  default 20)`: `websearch_to_tsquery('english', q)` against
  `vendor_discovery.notes_tsv`, joined to `vendors`, ranked by `ts_rank` +
  a name-match boost (reuse the relevance idea from `/api/places` blended search).
  **Address is not in `notes_tsv`** (it's name + tags + tldr + notes), so to keep
  the early slice's address search the RPC must *also* match `address_text`/`city`
  directly — or, better, treat a typed address as a **proximity** query: geocode
  it (existing `/api/geocode`), then surface vendors near that point via a
  `vendors_near`/bbox lookup. Proximity is the robust fix for "exact address →
  vendor" (plain string matching only fires when the typed text is a substring of
  the stored address, and misses entirely when the pin sits at a city-centroid
  fallback); it's the recommended Phase-2 upgrade over the shipped `ilike` slice.
- Explore bar (`app/(app)/explore/page.tsx`): keep the existing geocode flow, add
  a parallel vendor call; render grouped suggestions — **Areas** (MapPin rows,
  current behavior) and **Vendors** (category icon + name + tldr snippet — tldr
  replaces the address line once §8 exists). Tap area → flyTo (unchanged). Tap
  vendor → `/vendor/[id]?from=/explore`. If a future variant flies to a vendor on
  the map instead of opening its page, use the vendor's **stored** coords, never a
  re-geocode of the address (re-geocoding is exactly what breaks for
  approximate/centroid pins). Submit free text with no area match → open the list
  view (§9) fed by FTS results. Log to `search_queries` (parsed = null).

### Phase B — AI parser + scored ranking

- Route `app/api/search/route.ts`:
  1. Rate limit via existing `check_rate_limit` (e.g. 20/min per IP + a daily cap
     for guests; fails open like `lib/rate-limit.ts` if the RPC is absent).
  2. One Haiku call (`claude-haiku-4-5-20251001`, structured JSON output) parses
     the query into:
     ```json
     { "location_text": "Boulder", "types": ["venue"],
       "budget": { "amount_cents": 1000000, "unit": "event" },
       "capacity_min": 150, "tags": ["barn", "outdoor_ceremony"],
       "free_terms": ["moody"] }
     ```
     Env: `ANTHROPIC_SEARCH_API_KEY` (separate metered key, same rationale as the
     batch key: never `ANTHROPIC_API_KEY`). Missing key → route degrades to
     Phase A FTS, UI copy unchanged.
  3. `location_text` → existing `/api/geocode` logic → bbox; types/tags/budget/
     capacity → RPC `rank_vendors(...)`.
- RPC `rank_vendors(bbox, p_types, p_budget_cents, p_capacity_min, p_tags text[],
  p_terms text, max_rows int default 50)` returns vendors **scored, never
  filtered** (decision #1), each with match labels the UI renders as badges:
  - price score: overlap of `[p_budget]` with the vendor's obs envelope
    (same-unit only) → `within budget` / `near budget` / `above budget` /
    `no quotes yet` (missing data = neutral score + badge, not exclusion);
  - tag score: fraction of requested tags present (`matches: barn · outdoor`);
  - capacity: fits / unknown / too small (small penalty, still listed);
  - `p_terms` (free_terms + leftovers): `ts_rank` contribution now; embedding
    similarity in Phase 4.
  - tiebreak: `popularity`.
- Results render in the list view (§9) with the badge row per card. Log query +
  parsed payload + result_count.

### Phase C (Phase 4 in the roadmap) — embeddings for open vocabulary

- Embed per vendor: `name + tldr + tags + concatenated active recon notes`
  (refreshed by the nightly job when notes changed). Query embedding computed in
  `/api/search`; `free_terms` scoring switches from ts_rank to
  `1 - (embedding <=> query_embedding)` blended ~30% into the total score
  (structured components keep ~70% — embeddings can't do arithmetic on budgets,
  decision from the 2026-07-23 discussion).
- Provider: Voyage AI `voyage-3.5-lite` (or current cheapest tier) — corpus is
  a few hundred KB, so backfill is < $0.05 and queries are ~free. New env
  `VOYAGE_API_KEY`. Missing key → free_terms falls back to ts_rank.

## 8. TL;DR line

Generated in the same extraction passes (vendor-level record), stored in
`vendor_discovery.tldr`. Format contract: `<what it is> · <price shorthand> ·
<capacity/coverage>`, ≤120 chars, no marketing adjectives, omit unknown segments.
Examples: "Restored 1900s barn in Larkspur · ~$9–14k · up to 200" /
"DJ + MC duo, Front Range · from $1.8k · EDM-friendly". Surfaces: cluster list
sheet rows (`cluster-list-sheet.tsx` — replaces the current raw recon preview
line), list view cards, vendor page subtitle. Regenerated only when a vendor
gains/loses recon (nightly job checks `updated_at` vs newest entry).

## 9. List view

A second *presentation* of the query the map already runs — not a second query
system:

- Toggle on Explore (map/list segmented control near the type chips). List mode
  renders the current `vendors_in_bbox` result (same bounds, same type chips) as
  cards: photo thumb, name, TL;DR, price band, tags row, Well-loved badge,
  recon count. Sort control: Popularity (default) / Price low→high / Newest recon.
  Cap 100 with a "zoom in to narrow" hint.
- Needs the bbox RPC to also return discovery fields: `0020` extends
  `vendors_in_bbox` (it's `create or replace` — same signature + new columns
  `tldr, tags, price_low_cents, price_high_cents, popular`, left-joined from
  `vendor_discovery`).
- Reuse `cluster-list-sheet.tsx` structure/components where practical; AI search
  results (Phase B) feed this same list component with badge rows added.

## 10. Guardrails & risks

- **Google ToS:** Places content other than place IDs has a 30-day caching cap.
  We store `g_rating`/`g_count` as *internal scoring inputs* refreshed by pipeline
  runs and never display them; the displayed artifact (our derived popularity
  badge) is our own aggregate. Do not render "4.8★ (312)" from Google data
  anywhere. If this ever feels too close to the line, drop the Google component —
  the formula degrades gracefully to Reddit-only.
- **Defamation:** negatives must be sourced and attributed inline (existing draft
  rules); watch-outs extraction copies source phrasing, never escalates it.
  `watch_outs` payload fragments are inputs to recon text and TL;DRs are kept
  neutral-factual — no "avoid this vendor" style output anywhere.
- **No-key degradation:** every AI-dependent path fails open to a non-AI
  behavior (extract: wait for next run; search: FTS; embeddings: ts_rank). The
  app must never hard-require an Anthropic/Voyage key at runtime.
- **RLS:** raw extraction payloads and the query log are service-role only;
  `vendor_discovery` and `recon_price_obs` are public-read (derived from public
  recon), write-locked.
- **Versioning:** `EXTRACTION_VERSION` bump = full re-extraction through the
  normal incremental path; popularity re-weighting = refresh only (no
  re-extraction). Keep these decoupled.
- **Removed/flagged recon:** refresh fn only aggregates `status = 'active'`
  entries; `on delete cascade` handles hard deletes; the nightly job re-refreshes
  vendors whose entries changed status.

## 11. Cost summary

| Item | One-time | Ongoing |
|---|---|---|
| Backfill extraction (Batch API, per region+type) | ~$1–2 | — |
| Reddit valence pass (rides in the same batch) | ~$0.50 | — |
| Nightly incremental extraction (Haiku) | — | < $0.50/mo |
| AI search parsing (Haiku, ~1k tok/query) | — | ~$1/mo per 1k searches |
| Embeddings (Voyage lite) | < $0.05 | ~pennies |
| Supabase (pgvector, FTS, new tables) | free tier | free tier |

## 12. Phases, order, and acceptance criteria

Each phase is independently shippable; an executing agent should do exactly one
phase per instruction and stop at its gate.

**Phase 1 — Foundation (schema + extraction + backfill).**
Migrations `0018`+`0019`; `lib/constants/discovery.ts`; `extract.mjs` +
`upload-extractions.mjs`; nightly `/api/cron/extract`; dossier/skill watch-outs
edits (§5); backfill CO venues + one non-venue type end-to-end.
*Accept:* every active recon entry has an extraction row; `vendor_discovery`
populated with tldr/tags/price band/popularity for backfilled regions; a new
recon entry gets extracted within 24h with zero manual steps; `npm run build`
green. *Gate:* Kiara reviews a sample of ~30 tldr/tags/price rows in a CSV before
anything is surfaced in UI.

**Phase 2 — Surfacing (no AI at runtime).**
`0020` bbox RPC extension; list view + sort; TL;DR in cluster sheet + vendor
page; Well-loved badge; **upgrade** the already-shipped unified-bar vendor slice
(§7 Phase A "Shipped early") from `ilike` to the `search_vendors` FTS RPC + add
query logging. *Accept:* list toggle works over live viewport data; searching
"barn" surfaces tagged/noted vendors grouped under "Vendors"; queries land in
`search_queries`. *Gate:* Kiara approves badge copy + list card layout.

**Phase 3 — AI search bar.**
`/api/search` (parse → `rank_vendors` → labeled results), rate-limited,
FTS fallback. *Accept:* "wedding venues in Colorado with a barn under $10k"
returns ranked list with budget/tag badges, including over-budget and
no-quote barns labeled as such; route degrades to FTS with the key unset.
*Gate:* Kiara runs ~10 real queries and signs off on ranking quality.

**Phase 4 — Embedding layer.** `0021`, Voyage backfill, hybrid free-term
scoring. *Accept:* "moody forest elopement feel" measurably beats the
Phase 3 ts_rank baseline on the logged-query replay set.

**Phase 5 — Wedding profile + fit ranking (design sketch only, spec before
building).** `0022` profile fields; onboarding step; default ranking becomes
fit-to-profile; per-person price obs projected via guest count; compare table
in Hub reading the same facets.

## 13. Open questions for Kiara (answer before the relevant phase)

1. Tag vocab (§4.3): prune/extend the starting lists? (Phase 1)
2. TL;DR on the map popup itself, or only sheet/list/vendor page? (Phase 2)
3. Well-loved threshold: top 10% per type+region feel right, or rarer? (Phase 2)
4. Guest search: allow the AI bar without an account (rate-limited harder), or
   auth-gate it? Explore is public by principle (deeplinks), so lean public. (Phase 3)
5. Watch-outs surfacing: beyond recon text, do we ever want a distinct
   "heads-up" line on the vendor page? (Deferred — riskiest surface, needs its
   own review.)
