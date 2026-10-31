# Customer journey implementation plan

Status: engineering handoff, 31 October 2026. Application implementation has not started as part of this planning task. Google ratings are a fast follow, not a dependency for the first release.

## Goal and context

Help couples find a manageable starting set of wedding vendors that match their preferences and are nearby. Ask only for information needed for the current vendor category. Give users three suggestions, a complete results feed, and a map, all backed by the same matching rules and search state. Returning visitors should resume their search or choose their next vendor without repeating setup.

This changes discovery and the customer journey. It does not replace the vendor directory, recon system, Planning Hub, verification system, or existing list-feed cards. Preserve those working systems and extend them.

The intended reader is an engineer new to the repository. Implement the milestones in order; each has an observable completion condition. Do not make production data changes or run billed vendor-research APIs merely to test the UI.

## Design and source references

- [Figma user journey diagram](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-732): first visits, returning visitors, map interactions, arrows, and destination notes.
- [Figma implementation handoff](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=43-258): approved semantics, original drawing, radius reference states, and regression examples.
- [Original drawing in Figma](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=43-262).
- [25-mile map reference](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=43-274) and [50-mile reference](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=43-432). The drawn circles are schematic; production must use real geographic geometry.
- [Read-only matching audit](../mockups/customer-journey-v1/matching-feasibility-audit.json): 2,223 live vendors inspected on 31 October. This is a dated sample, not a permanent assertion about production counts.

| Screen | Purpose | Figma |
| --- | --- | --- |
| 01 | Ask whether the visitor has a venue | [Welcome](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-763) |
| 02 | Identify a booked venue, with city fallback | [Venue location](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-803) |
| 03 | Choose a city when still searching for a venue | [Search area](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-842) |
| 04 | Choose one vendor type | [Category grid](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-882) |
| 05 | Venue budget, one guest count, setting, Advanced | [Venue preferences](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-979) |
| 06 | Photography budget, style, Advanced | [Photo preferences](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-1022) |
| 07 | Up to three suggested matches | [Suggestions](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-1067) |
| 08 | Existing list-feed cards with the new category heading and preference pills | [Full feed](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-1138) |
| 09 | One vendor type, inline key filters, map and Advanced sheets | [Map](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-1215) |
| 10 | Resume unfinished work | [Resume](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-1321) |
| 11 | Show all 11 vendor types immediately | [Returning user](https://www.figma.com/design/IFtSIpXiq7aTzWkApqMkJF?node-id=2-1358) |

The diagram's small destination cards are journey requirements, not completed screen designs. Existing mockups use illustrative vendors/counts. Preserve the user's latest Figma edits: inspect the live nodes before editing, change only the intended controls, and never regenerate the entire file from old local SVGs. The old files under `mockups/customer-journey-v1` are historical snapshots, not the current visual source of truth. Do not run their generator or old mutation scripts to update Figma.

### Original handwritten journey

![Original handwritten Wedding Recon journey](assets/customer-journey/original-handwritten-journey.jpeg)

The drawing establishes the two first-visit branches, unfinished-flow resume, returning-user category selection, suggested results, list feed, and map. The Figma diagram extends it with Advanced sheets, account/save return, and proposed downstream destinations. Later decisions below take precedence over ambiguous details in the sketch.

## Accepted requirements

1. A suggestion must match every active filter and be within the search radius. Missing information is not a confirmed match.
2. Start at 25 miles from the selected venue location or city centroid. If fewer than five confirmed matches exist, expand once to 50 miles. Rank after finding the eligible set, then show at most three suggestions.
3. One to four confirmed matches is a valid result. Zero confirmed matches produces a dedicated screen with an Adjust filters CTA. Full results retain the existing partial-match tier.
4. Include equality: a $5,000 starting fee fits a $5,000 budget; capacity 150 accommodates 150 guests.
5. Venue budget is a package/event-fee total. Use package prices directly and estimated package prices for convertible units. Use the user's actual guest count for per-person conversion.
6. Catering budget is per person. Ask for guest count, including when needed to normalize a package quote.
7. Guest count is one number, not a minimum/maximum range. Compare it with the stored maximum capacity.
8. Price comparisons must refer to the selected service scope. A coordination fee cannot establish a full-planning fee; a bouquet cannot establish full-service wedding-flower pricing.
9. Florist budget must be at least the greater of the applicable starting price and applicable minimum spend. Both must refer to comparable units and service scope.
10. Hotel-block price belongs under Advanced, not among default controls. Unknown prices remain unknown even when the filter exists.
11. Reuse the current full/partial/excluded matcher and the existing ranking. Keep verified, price presence, and photo presence before distance. Do not introduce a recon-confidence score.
12. Vendor type is single-select. Setting/style can still be multi-select. All 11 vendor types are visible immediately on screen 11.
13. Venue opens budget, guest count, and setting by default, in that order. Photos opens budget then style. Other existing filters live under Advanced.
14. Use a radius slider and lightly display the geographic boundary. Preserve edit/back/close, category-specific preferences, list/map state, vendor round trips, and sign-in save intent.
15. Google rating and rating count are a fast follow. Do not add rating-driven sorting, rating calls, or a rating dependency to the first release.

### Suggested implementation defaults

These fill in details not explicitly selected by the user; keep them centralized so product review can change them without rewriting the feature.

- Radius slider: 5–50 miles, step 5. Initial automatic search uses 25/50. A manual adjustment disables automatic expansion until a new location or an explicit reset to automatic search.
- Five hours remains the default estimate for hourly venue prices; show the assumption. Do not silently apply it to unrelated vendor types.
- Use an explicit Search this area action to move the radius center. Merely panning/zooming does not move it.
- Inline fields apply when valid, after blur/Enter or a short debounce. While typing an incomplete number, retain the last valid search instead of flashing zero results.
- Advanced keeps a draft until Apply. Close/Cancel discards the draft and keeps the previously applied filters.
- Store anonymous progress on this device. Signed-in planning context syncs across devices; do not describe anonymous cross-device recovery as supported.
- For ambiguous florist service scope, ask Full service / À la carte / Either before treating a total budget comparison as confirmed. Reuse the existing engagement-model vocabulary; Either means no scope restriction, not a new vendor attribute.
- Match any selected value within a multi-select field; combine different active fields with AND. This is already how the matcher works.

## Read the existing implementation first

Before writing Next.js application code, read `AGENTS.md` and the relevant bundled guides. This repo uses Next 16.2.9 and React 19.2.4; do not substitute remembered middleware/caching conventions.

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`

| Existing code | Reuse or extend it for |
| --- | --- |
| `lib/filters/match.ts` | Full/partial/excluded verdicts, OR/AND semantics, selection building, partial-match fraction |
| `lib/constants/vendor-filters.ts` | Category definitions, original price units, conversion constants and Advanced fields |
| `lib/filters/vendor-tags.ts` | Displayed price/capacity tags; keep original source units separate from calculated comparison amounts |
| `lib/map/rank.ts` | Shared ranking comparator |
| `components/map/vendor-map.tsx` | Candidate loading, cache/truncation safeguards, map layers and visible-result plumbing |
| `lib/map/viewport.ts`, `lib/map/rpc-fanout.ts` | Conservative envelope loading, shared cache behavior, bounded concurrency |
| `app/api/map/vendors/route.ts` | Existing public, cookie-free, cached pin endpoint; retain its behavior for old callers |
| `supabase/migrations/0045_vendors_in_bbox_verified.sql` | Verified flags and read-time published filter overrides |
| `components/map/vendor-feed.tsx` | Existing cards, partial divider, pagination and scroll restoration |
| `components/map/vendor-preview-card.tsx` | Shared vendor cards and recon-preview carousel |
| `components/map/vendor-filter-sheet.tsx` | Existing field options and range/filter UI; adapt without creating another matcher |
| `app/(app)/explore/page.tsx` | Current query/state restoration, map/list switch and category state |
| `lib/landing/first-visit.ts`, `components/mark-visited.tsx`, `proxy.ts` | Landing/visited behavior; keep it distinct from unfinished-search status |
| `components/vendor/save-button.tsx`, `app/(app)/hub/page.tsx` | Saving and Planning Hub |
| `lib/auth/post-signin.ts`, `lib/auth/post-signin-redirect.ts`, `app/(auth)/actions.ts` | Existing safe return destination, code/link completion, username/Terms onboarding |
| `components/portal/filter-override-editor.tsx` | Vendor-authored overrides; do not break verified vendors' published data |

### Important findings and pitfalls

**Florist bug today:** `VENDOR_FILTERS.flowers.price` has no `basis` and no `basisScale`. Its `rescaledBy: "engagement_model"` affects the histogram; it is not a per-bouquet-to-event conversion. The matcher only checks incompatible units when a selection specifies a basis. Consequently `price_min: 175, price_basis: "per_item"` is currently a full price match against a $5,000 ceiling. Minimum spend is a separate optional field and is not automatically combined with starting price. Fix this explicitly, not with a dollar-value plausibility threshold.

**No rare exceptions today:** the older `docs/vendor-filter-coverage.md` describes rare-filter exceptions. Current `lib/constants/vendor-filters.ts` and `docs/filter-recon-reconciliation.md` explicitly state that they were removed on 6 August. `rare` is a UI hint. Keep missing values partial, explicit contradictions excluded; update stale documentation rather than restoring an old exception accidentally.

**Budget estimates are calculated:** raw prices, basis, kind, confidence and tiers are stored. The reusable conversion configuration exists, but there is no separate persisted normalized package estimate. Calculate estimates from current search context; changing guest count must recalculate affected comparisons.

**The current result boundary is a rectangle:** the list is derived from the visible map bounds and distance is measured from the camera center. A radius search must not inherit either behavior accidentally. Its center is search state, separate from the camera, and its distance uses original coordinates before display-only pin fanning.

**Attributes currently load lazily:** guided matching must wait for the effective filter attributes, not declare unfiltered pin rows to be matches while the attribute request is still pending.

**Type switching currently drops inactive filters:** `updateSelectedTypes`/`pickTypes` in Explore prune category state. The new journey must retain inactive categories' answers while selecting only one category for results.

## Milestone 1 Define the shared search contract

Goal: one representation of the search drives onboarding, suggestions, feed and map.

Suggested new modules: `lib/search/journey-state.ts`, `lib/search/category-config.ts`, `lib/search/execute-search.ts`. These are proposed paths, not existing APIs. Keep pure data/matching functions separate from React components and database clients.

1. Define a versioned state schema and validation. Reuse `VendorType`, `FilterState` and `FilterSelections` where appropriate rather than making incompatible copies.
2. Replace the active type array in the guided experience with one `selectedVendorType`. Retain an adapter for legacy multi-type URLs; suggested policy: the first valid type becomes active while other categories' stored answers remain available.
3. Keep a common `guestCount`, a booked venue/city anchor, and per-category budget/service/filter values. Wedding headcount is not the number of bridesmaids or beauty-service recipients.
4. Separate applied filters, Advanced draft filters, the search anchor and the map camera.
5. Define a stable search key including location, type, applicable guest count, budget unit/scope, filters, radius mode and radius. UI-only changes such as opening a sheet must not change it.
6. Define the state transitions before building components. Use the table below as acceptance criteria.

Example shape; adjust names to existing types, not the semantics:

```ts
type JourneyState = {
  version: 1;
  location: { kind: "city" | "venue"; label: string; lat: number; lng: number; vendorId?: string } | null;
  guestCount?: number;
  selectedVendorType: VendorType | null;
  byType: Partial<Record<VendorType, CategorySearchState>>;
  radius: { mode: "auto" | "manual"; miles: number; expandedBecauseSparse: boolean };
  flow: { status: "in_progress" | "completed"; step: JourneyStep } | null;
  view: "suggestions" | "list" | "map";
};
```

Keep Advanced draft state ephemeral; do not save an unapplied draft as the user's applied search. `CategorySearchState` includes a budget amount with explicit comparison unit and service scope, plus existing attribute selections. Do not infer units from an input's formatted dollar string.

| Event | Required transition |
| --- | --- |
| New visitor has venue | Venue lookup → category grid → category preferences |
| New visitor has no venue | City lookup → Venue preferences; do not add an unnecessary category-picker step |
| Return with unfinished work | Offer resume at the last unfinished step with answers intact |
| Return without unfinished work | Screen 11, all vendor types visible |
| Change type | Restore that type's answers; reuse location/headcount; discard only unapplied sheet edits |
| Change location/booked venue | Keep preferences; reset automatic nearby search to 25 miles and recompute |
| Change guest count | Recompute capacity and any affected price conversions |
| Back/close setup | Preserve progress and usable applied context; show Explore rather than restarting welcome |
| Apply Advanced | Commit its draft atomically, recompute and close |
| Close Advanced | Keep previously applied filters |
| Open a vendor/back | Restore view, applied search, scroll and selected map pin |
| Complete suggestions | Mark flow completed, but retain its search context for later use |

Done when pure tests cover these transitions without mounting the map or calling production services.

## Milestone 2 Make prices comparable and correct florist data

Goal: every budget comparison uses a known unit and applicable service scope while preserving raw source evidence.

### Comparison units

| Type | Input and comparison unit | Required scope/context |
| --- | --- | --- |
| Venue | Total event/package fee budget | Guest count for per-person quotes; disclosed five-hour estimate for hourly quotes |
| Photos | Photography package budget | Applicable wedding/coverage package; do not use an elopement quote for a non-elopement request |
| Food | Per-person budget, plus guest count | Applicable catering service; package minimums can be divided by actual guests |
| Flowers | Total floral budget | Full service, à la carte or Either; do not infer total from one bouquet |
| Planner | Budget for selected service | Full planning, partial planning, coordination, etc. |
| DJ / band | Package budget | Convert hourly only when relevant duration is explicit/approved; no arbitrary shared venue multiplier |
| Beauty | Existing Bride / Per bridesmaid price inputs | Selected hair/makeup scope; no whole-party total inferred from a single-person price |
| Dress | Per-gown budget | Gown price, not alterations/add-ons |
| Hotel | Per-night budget, Advanced only | Actual room/block rate; an event package is not a room rate |
| Other | No generic default budget | Show only fields supported by that category's schema |

### Implementation steps

1. Add `lib/filters/comparable-price.ts` as a pure helper. Input: effective vendor filters, vendor type, selected service and search context. Output: known comparable starting floor or unknown, unit, source/estimate explanation, and any supported contradiction. Validate finite, nonnegative numbers and sensible range ordering.
2. Use structured fields. Never parse abbreviated card text such as `$5k`, reuse `price_quote` as executable pricing data, or overwrite raw prices with context-dependent estimates.
3. For a package floor `P`, compare `P <= budget`. For venue per-person `P`, compare `P * guestCount <= budget`. For catering package `P`, compare `P / guestCount <= perPersonBudget`. Reject zero/negative guest counts before dividing. For venue hourly `P`, use five hours and label the estimate.
4. Retain date-tier logic when season/day is selected. With no date context, a starting-price match is not a claim that any wedding date has that price. Keep the displayed starting/estimated label.
5. Treat unknown or incompatible basis as unknown, rather than silently assuming a package. Permit audited legacy package values through an explicit compatibility path backed by evidence. A per-night venue value is not automatically convertible to an event package.
6. Feed the resolved value into the existing matcher using a derived, transient comparison field and a `buildSelection` adapter. Continue using `filterMatchFor`; do not build a parallel full/partial/excluded implementation for suggestions. Preserve its counts and partial ranking.
7. Keep displayed source tags in their original units. Add an estimate explanation where the user sees a calculated total. The map, suggestion card, feed and detail page must not show contradictory costs.
8. Keep verified published overrides in the resolution path. Match the read-time merge behavior of `vendor_filters_in_bbox`; do not compare extracted data while rendering contradictory vendor-authored overrides.

Suggested return structure:

```ts
type ComparablePrice =
  | { status: "known"; floor: number; unit: "package" | "per_person" | "per_gown" | "per_night"; estimated: boolean; explanation?: string }
  | { status: "unknown"; reason: "missing" | "unit" | "scope" | "invalid" };
```

The matcher adapter, not the UI, must handle a known minimum above budget as a positive contradiction even when another relevant price is unknown. A zero minimum does not prove a zero-cost package. A maximum-only quote must not be fabricated into a known starting price; test its unknown/bounded behavior explicitly.

### Florist correction and service offers

The audit found seven explicit bouquet-priced florists and mixed-scope package rows. Two examples to turn into fixtures:

- Buckley House of Flowers: a bridal bouquet starting at $175; not a complete wedding-flower package.
- Emma Lea Floral: à-la-carte minimum $350, full-service minimum $3,000. A single flattened $350 floor cannot represent both.

1. Generate a dry-run audit of all flower rows with prices/minimums, their basis, engagement models and evidence. Include vendor overrides. Review all mixed-scope rows, not just the seven `per_item` rows. Do not use a price threshold to decide whether something is a bouquet.
2. Add a narrowly scoped optional `filters.price_offers` structure when multiple service scopes cannot fit the legacy fields. Each offer records `scope`, `basis`, `price_min`, optional `price_max`, optional `minimum_spend`, `price_kind`, confidence, source/evidence and optional date tiers. Use the existing engagement/service vocabularies. Missing fields remain absent, not false or zero.
3. Keep legacy prices for presentation/backward compatibility. The new resolver prefers audited offers for a selected scope. For legacy fields, use them only when unit and scope are unambiguous.
4. For each compatible floral offer, use `max(applicable starting price, applicable minimum spend)` over supported, comparable floors. A bouquet price cannot join this maximum for a full-event budget. A per-person wedding-floral estimate requires known guests and matching scope. Unknown scope cannot be fixed by multiplying bouquet price by wedding guest count.
5. For Either, evaluate compatible offers as alternatives. One known affordable offer can match. If all known offers fail but an applicable offer is unknown, preserve unknown/partial status instead of claiming the vendor is definitely unaffordable.
6. If a known applicable minimum already exceeds the budget, exclude that offer even if its other price is unknown. If only per-bouquet data exists for an event-total request, the price criterion is partial.
7. Extend override validation/editor and future enrichment emission to preserve the new structure. Read `docs/enrich-filter-emission.md` and `docs/filter-recon-on-write.md`; don't let the next enrichment run flatten or erase reviewed offers. Keep mirror files synchronized using the repository's sync command if skill contracts are changed.
8. Backfill with a reviewed allowlist, provenance and before/after diff. Do not overwrite human-authored data or verified overrides with extraction defaults. Use a new idempotent script; do not rerun a broad historical backfill against production blindly.

This can remain optional JSONB metadata without a new top-level column. Any migration or schema/editor validation still needs tests and an explicit reviewed rollout. Choose the next unused migration number rather than assuming a number from this document.

Done when budget/capacity boundaries, mixed units, scope alternatives and per-bouquet regressions pass; the displayed price and matching decision use compatible evidence. Do not wait for every unpriced vendor to be researched: unknowns must work correctly.

## Milestone 3 Add radius search with shared candidate loading

Goal: suggestions, map counts and the full feed use the same candidate set, independent of screen dimensions or camera bounds.

Suggested new modules: `lib/map/radius.ts`, `lib/search/candidates.ts`. Add a public candidate route under `app/api/search/candidates/route.ts` only if the existing cached endpoint cannot carry the needed attributes cleanly. Do not change the old endpoint's contract without migrating its callers.

1. Implement mile-to-meter conversion and great-circle distance from the search anchor. The radius is straight-line distance, not driving distance. Handle longitude wrapping, polar limits and invalid coordinates defensively. Use original stored coordinates, not rendered fan offsets.
2. Build a conservative envelope for the maximum 50-mile radius. Reuse bounded per-type loading and the existing cached public pin route. Load effective filter attributes before computing match counts. Another valid implementation is a new PostGIS radius RPC; use the existing geography index and meter units if taking that route.
3. Preserve the current truncation safeguards. A response at the row ceiling is not a complete set. Partition/paginate until complete or return an explicit incomplete/error state; never interpret truncation as fewer than five matches. The audited per-type counts fit under the present ceiling, but that is not a permanent guarantee.
4. Keep public search results cookie-free if edge-cached. Follow `app/api/map/vendors/route.ts` and `proxy.ts`; a session-refresh cookie must not make a public shared response personalized. Never expose service-role credentials to the browser.
5. Match and rank using the shared pure functions. For automatic mode, count rank-1 vendors within 25 miles. If fewer than five, use rank-1 vendors within 50. Partial matches do not count. Return confirmed/partial counts and chosen radius, not only the first three IDs.
6. Apply the same radius to partial matches in the full feed. Contradictions stay excluded. If there are no confirmed matches but partials exist, suggestions show No confirmed matches / Adjust filters, with a secondary option to inspect the partial feed.
7. Cache loaded candidates for the maximum radius while center/type are unchanged. Slider motion within that envelope can recompute locally. Scope/guest changes recompute normalized prices; stale response tokens must prevent an earlier search from overwriting a newer one.
8. Preserve verified and published override semantics across pin, attribute and preview loads. Group/version a search result so counts and IDs are based on the same applied inputs.

Algorithm sketch:

```text
await complete candidates + effective attributes for category within 50-mile envelope
normalize comparable price fields using applied context
compute current filterMatchFor verdict and true anchor distance for each vendor
radius = user-selected value when manual
otherwise radius = 25 if confirmedCountWithin25 >= 5 else 50
inside = candidates with distance <= radius
rank inside using compareRanked, with d based on the search anchor
suggestions = first 3 rank-1 vendors
feed = all ranked rank-1 vendors, then rank-0 vendors
```

Suggested response/state fields: `searchKey`, `center`, `radiusMode`, `radiusMiles`, `expandedBecauseSparse`, `confirmedCount`, `partialCount`, `complete`, ranked IDs/types/verdicts. Derive the suggestion slice from the ranked set; do not fetch arbitrary three rows and then filter them.

Done when changing the viewport size or panning without Search this area does not change the eligible set, the five-result threshold precedes the three-card cap, and all zero/partial/error distinctions work.

## Milestone 4 Build the guided journey and category controls

Goal: implement the Figma paths using existing components and the shared state, not an unrelated second app.

Suggested new components under `components/search/`: `journey-controller.tsx`, `category-picker.tsx`, `category-preferences.tsx`, `inline-filters.tsx`, `radius-control.tsx`, `suggested-vendors.tsx`, `no-matches.tsx`. Names can change, responsibilities should not.

1. Coordinate new-user entry with the existing landing gate. A visited cookie does not mean onboarding completed. `/onboarding` currently means username/Terms onboarding; do not reuse that route for wedding search questions.
2. Implement screens 01–06 and resume behavior. Use `PlacesCombobox`/existing venue search and `/api/geocode` where possible. If a venue cannot be found, allow city lookup. Do not collect or assume availability; “match” means filters and nearby.
3. Render all vendor types from `VENDOR_TYPES`/`CATEGORIES` on screen 04 and screen 11. Keep a single active type and all 11 options available without a See all step. Use Other as a visible option. Do not hardcode only Venue/Photos because those are the detailed mockups.
4. Implement simplified numeric budget fields with explicit units and one integer guest input. Empty means no filter, not zero. Validate finite/nonnegative monetary values and a positive whole-number guest count. Do not constrain valid inputs to the old histogram bin edges.
5. Venue shows budget, guest count, setting; Photos shows budget, style. Caterers show per-person budget and guest count, then the existing food filters. For other categories use existing field definitions and choose a small default set; do not invent new taxonomy. Hotel price is Advanced only and visibly supports unknown data.
6. Reuse the existing options in Advanced. Keep rare markers and unknown semantics. There must be one shared input-to-selection adapter for preferences and map controls.
7. Screen 07 shows up to three confirmed matches and View all N matches. Render the shared `VendorPreviewCard`; preserve links back to the originating search. All types need category-correct results, not photographer content after Venue.
8. Screen 08 reuses `VendorFeed`, its card carousel, partial divider, pagination and scroll restoration. Retain the newer category heading and selected-preference pills from Figma; do not reintroduce the legacy All vendors filter header merely because the feed is reused.
9. Keep location as quiet text in setup/results. Provide an explicit Edit search action to correct the anchor. Do not make a decorative location badge look like an action.
10. Define keyboard focus for modal sheets, focus return, visible error messages, accessible field labels and touch targets. Longer category labels and 320px screens must wrap without hiding options or covering the primary CTA.

Done when a first visitor with or without a venue can reach real category-correct suggestions, and a returning visitor can select any vendor type immediately.

## Milestone 5 Add the radius UI and map interactions

1. Draw a geodesic GeoJSON polygon approximating the chosen mile radius; use a subdued fill and thin stroke. A MapLibre `circle-radius` value is in pixels, not geographic miles. A screen-sized circle is not a correct implementation.
2. Put the radius control in the compact map filter panel. Show the chosen distance in text. Keep the center/location field distinct from vendor type. Single-select type changes the inline fields and pin color.
3. Preview the ring while dragging; update matching locally when cached candidates permit. Commit valid slider state on release/keyboard change and debounce network work. Do not make a Google Places request or a database round trip for every pointer movement.
4. Announce automatic expansion once with quiet copy such as “Expanded to 50 miles for more matches.” Do not ask the user to reconfirm an already-agreed automatic rule.
5. Once the radius is manually chosen, do not fight the slider by auto-expanding it back. Add a discoverable reset to the default automatic search behavior.
6. Keep the anchor fixed during ordinary pan/zoom. Search this area changes the anchor and reruns the agreed radius policy. Fit the ring initially, but do not keep snapping the camera back while the user inspects pins.
7. Open Setting, Style and Advanced as focused sheets; Apply returns to the same map. Category switches restore that category's values. Apply the same result IDs to Map and List.
8. Show approximate-location treatment using the existing precision heuristic. Do not show city-centroid vendors as precisely “0.0 miles away.” Vendors with no coordinates cannot be confirmed nearby; keep them out of nearby suggestions and report them for data repair rather than assigning invented locations.

The ring and slider add no paid mapping API. They still consume normal hosting/tile/database resources. MapLibre already supports GeoJSON sources; a 64–96-point polygon or equivalent tested helper is sufficient. Keep any new geometry dependency small and justified. [MapLibre reference](https://maplibre.org/maplibre-gl-js/docs/examples/draw-a-circle/).

## Milestone 6 Preserve progress and complete the save journey

Goal: editing, back navigation and authentication do not erase the work users have already done.

1. Persist a versioned anonymous journey draft in local storage with validation, a timestamp and a clear/reset operation. Storage failure must not prevent using the app. Keep current per-tab map/feed scroll keys for navigation restoration; persistent wedding-search context is a different responsibility.
2. Add an authenticated planning-context store for cross-device recovery. A small per-user table with JSONB payload, schema version and revision/updated timestamp is sufficient. Enable RLS so a user can read/write only their own row; the public candidate cache must not contain this state.
3. On sign-in, merge deliberately: a pending local action and active local draft win for the current return journey; do not silently overwrite a newer server context with an old inactive draft. Use a revision check and expose a recoverable conflict choice when both contexts have meaningful divergent work. Keep per-category states when merging.
4. Before sending a signed-out visitor to login from Save, persist a validated pending save with vendor UUID, return context and short expiry. Reuse `sanitizeSignInDestination` and the existing intent-cookie flow. Do not encode an arbitrary external redirect or the whole private state in a URL.
5. After email-code or email-link sign-in, and after required username/Terms onboarding, execute the intended save once and return to the vendor/search. Existing duplicate-save protection must make retries safe. Clear the intent only after confirmed success; a recoverable save failure should offer Retry without restarting setup.
6. Signing out must clear account-specific local state and prevent drafts from leaking to the next account on a shared device. Keep anonymous public browsing functional.
7. Preserve an accessible route to the Planning Hub and Add recon. Reuse existing pages; the diagram's small destination cards are not instructions to redesign them.

Done when a signed-out Save survives both auth completion paths and onboarding, results in exactly one saved vendor, and restores the prior search/scroll. Same-device anonymous resume and signed-in cross-device resume must be tested separately.

## Milestone 7 Complete the missing states and Figma handoff

Before declaring UI implementation complete, add or verify these states in Figma and the app:

- Catering preferences: per-person budget plus one guest count.
- Florist full-service vs à-la-carte price scope, including quote-only/partial pricing.
- Hotel price under Advanced, with missing-rate state.
- No confirmed matches after 50 miles, Adjust filters, and optional access to partials.
- One/two matches, three of four matches, and View all count behavior.
- Initial loading, retryable candidate/attribute errors, stale-response protection, and incomplete data loads.
- Radius 25, automatic 50 with notice, manual radius, and Search this area.
- Signed-out Save → sign-in/onboarding → restored vendor with save completed; save failure/retry.
- Location edit, empty/corrupt local draft, and returning-user resume/new-search.

Use the existing design system: Geist, white surfaces, neutral primary buttons, category colors, restrained location text. Add arrows/annotations to the relevant journey, rather than scattering unreferenced frames. Label proposed states. Keep Figma node links in this plan current after any replacement. Preserve unrelated user edits and screenshot the changed compositions.

## Milestone 8 Test and release in small changes

Suggested pull requests, in dependency order:

| PR | Scope | Completion evidence |
| --- | --- | --- |
| 1 | Search state/types/category contract and pure transitions | Deterministic state tests; no UI behavior change yet |
| 2 | Comparable prices, florist offer compatibility, capacity adapter | Boundary/scope tests; reviewed dry-run florist diff |
| 3 | Radius candidate loading, distance and shared result set | Complete-count/truncation tests; fixture 25/50 searches |
| 4 | Guided entry, preferences, suggestions, feed integration | First-visit and returning flows exercised on mobile |
| 5 | Map inline controls/radius/sheets and manual overrides | Map/list consistency and keyboard slider checks |
| 6 | Persistent contexts, pending saves and auth return | RLS tests, both auth paths, merge/retry tests |
| 7 | Missing states, accessibility, Figma reconciliation, rollout flag | Full acceptance checklist and production monitoring plan |

Price normalization should land before matching UI goes live. Stage any data changes separately from UI deployment and keep compatibility with legacy fields during rollout.

### Required regression matrix

| Case | Expected result |
| --- | --- |
| Budget 5,000; package floor 5,000 | Confirmed price match |
| Budget 4,999; package floor 5,000 | Excluded on price |
| Venue $100/person; 150 guests; budget 14,999 / 15,000 | Excluded / matched, with estimate explanation |
| Catering $10,000/package; 100 guests; budget $100/person | Matched |
| Catering package but no headcount | Unknown price comparison until guests supplied; no fabricated division |
| Hourly venue, five-hour assumption | Correct estimated total; disclosed duration |
| Per-night room price on a Venue row | Unknown event price unless evidence explicitly establishes a compatible buyout offer |
| Floral bouquet $175; total floral budget $5,000 | Partial price, not a confirmed event-budget match |
| Full-service floral floor $3,000; à-la-carte minimum $350; full-service budget $1,000 | Excluded for selected full-service offer |
| Floral package floor $1,000, applicable minimum $4,500; budget $4,000 / $4,500 | Excluded / matched |
| Only a recorded zero minimum, no usable event price | Unknown package price, not a free event |
| Missing floor, malformed/negative/reversed range | Safe unknown or valid supported bound; no NaN/negative matches |
| Guests 150; capacity 150 / 149 / 300 | Matched / excluded / matched |
| Capacity missing | Partial; not counted toward radius threshold |
| Selected rare feature missing / explicit false / true | Partial / excluded / matched; no restored historical exception |
| Five full matches within 25 miles | Stay at 25; show at most three |
| Four full matches at 25 and four at 50 | Expand; show three with View all four |
| No full matches at 25, two at 50 | Expand; show two |
| Zero full but several partial at 50 | No confirmed matches CTA; partials remain inspectable in feed |
| Query error or attribute request pending | Retry/loading, never no matches |
| Candidate response reaches ceiling | Load remaining candidates or mark incomplete; do not trust expansion count |
| User manually chooses 10 miles with two matches | Honor 10; do not expand automatically |
| Pan without Search this area | Search membership unchanged |
| Map/List toggle or vendor round trip | Same candidates, counts, applied filters and restored position |
| Verified partial vs unverified full | Full match still comes first |
| Exact ties and centroid locations | Stable final ID tie-break; no random ordering; no false distance precision |
| Switch Venue → Photos → Venue | Venue fields restored; no lost category budget |
| Signed-out Save followed by either sign-in method | Pending save completed once; return context restored |

Extend the meaningful existing checks rather than replacing them with tests that repeat implementation details:

```sh
node scripts/test-filter-match.mjs
node scripts/test-rank-order.mjs
node scripts/test-filter-override-shape.mjs
node scripts/test-first-visit-gate.mjs
node scripts/test-snap-bbox.mjs
npm run lint
npx tsc --noEmit
npm run build
npm test
```

Add focused pure tests for normalization, radius, state migration, unknown/scope handling, and pending-save intent. The existing filter test uses an older checked-in corpus; supplement it with small reviewed fixtures for the live-data anomalies instead of silently substituting production data. Current baseline at planning time: `test-filter-match.mjs` reports 53 passed, 0 failed.

Use Playwright or the browser workflow to verify real user paths at narrow and normal mobile widths, keyboard focus, scroll restoration and delayed responses. No live Google calls or production writes in routine tests. Where credentials are absent, follow the repository's `verify` skill and fake backend rather than marking integration behavior as verified.

### Rollout and monitoring

1. Add a feature flag for the guided journey/radius result path; leave legacy behavior available for rollback. Persisted state must remain versioned and backward tolerant.
2. Review SQL, RLS and data-backfill diffs. Apply migrations through the repository's established hosted-database process; do not assume a code deploy applies SQL. Keep an idempotent rollback/compatibility path.
3. Deploy compatible server/data contracts before enabling the new UI. Confirm public candidate responses have the intended cache headers and no auth cookies. Confirm profile context responses are private.
4. Enable for internal review, then gradually. Check full/partial counts against fixture searches and manual database samples. Monitor truncation, request failures, zero-result frequency, expansion frequency, latency and auth-return/save failures.
5. Reuse `lib/analytics/posthog.ts` for coarse events: journey started/resumed/completed, category selected, preferences applied, radius expanded/manually changed, no confirmed matches, View all, pending-save/auth-return success/failure. Do not attach raw recon text, email addresses, or precise personal location. Use counts/category/radius and broad error codes.
6. Roll back the flag if counts diverge between suggestions/feed/map, auth loses pending saves, candidate loading repeatedly truncates, or latency regresses materially. Do not erase collected user planning context as a rollback mechanism.

## Fast follow Google rating and rating count

Goal: a simple external quality signal after the core journey works. No review-text analysis and no custom recon-confidence system.

1. Resolve allowed acquisition, retention, attribution and use with the current MapLibre map before designing a production rating cache. Google Places' standard terms restrict caching and use with non-Google maps; fetching only numeric fields does not remove those restrictions. Places UI Kit has different terms and must be assessed separately; do not assume it authorizes arbitrary custom ranking/export.
2. Request only the fields actually needed, such as `id,rating,userRatingCount`. Both numeric fields use Place Details Enterprise; adding the count does not raise the tier beyond rating alone. Do not request `reviews` or `editorialSummary` for this task.
3. At the 31 October 2026 standard global price, Place Details Enterprise has 1,000 no-charge monthly events, then $20/1,000 at the first paid tier. Assuming an unused allowance, 5,000 requests cost about $80 and 10,000 about $180. Recheck prices and billing-account allowances at implementation. These are requests, not permanently cached unique vendors.
4. Distinguish displaying ratings on three already-chosen cards from using ratings to select those three. Ranking the eligible pool requires a permitted way to obtain ratings for that pool before the final cap; it cannot be funded as only three lookups while claiming to rank everyone.
5. Use rating plus count to temper tiny samples. Agree a simple weighting/threshold and its placement in the comparator before launch. If rating is to materially affect choice, the proposed placement is after verified/price/photo and before distance; this is not part of the accepted MVP comparator.
6. Treat missing ratings neutrally, and show the count with the score. Google ratings may describe the overall hotel/restaurant rather than wedding service; do not label them wedding-specific satisfaction.
7. Add runtime fallback, request quotas, cost observability and permitted refresh behavior. The audited directory has 1,707 Google Place IDs out of 2,223 vendors; unresolved businesses must remain usable without invented scores.

Sources checked for this handoff:

- [Google field tiers](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Google service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms)

## Definition of done

- Both first-visit branches, resume and next-category journeys work with all 11 vendor types.
- Suggestions, feed and map share price normalization, eligibility, anchor, radius and ranking.
- Florist bouquet prices and mixed service scopes do not create false total-budget matches.
- One guest count drives venue capacity and relevant per-person/package conversions.
- Unknowns, explicit mismatches, errors and no confirmed matches are distinct.
- Radius expansion counts full matches before the three-card cap; manual radius is respected.
- The existing list-feed cards and partial-match behavior are reused.
- Back, dismiss, category switching, location editing, vendor round trips, save/auth return and signed-in context sync preserve the intended state.
- Figma reflects the implemented states; links and journey annotations are current; the original drawing remains available.
- Tests and migration/RLS review pass, cache behavior is checked, monitoring and rollback are ready.
- Google ratings remain disabled until their separate fast-follow requirements are met.
