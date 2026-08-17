#!/usr/bin/env node
/**
 * On-write reconcile - website backfill + filter-less drain (deterministic).
 *
 *   node scripts/reconcile/daily-websites.mjs --work <name>            (dry run)
 *   node scripts/reconcile/daily-websites.mjs --work <name> --apply
 *
 * This step owns the two jobs the model tag reconcile cannot do:
 *
 * 1. WEBSITE BACKFILL. For each dirty vendor with no website but a
 *    google_place_id, ask Google Places for its websiteUri and set
 *    vendors.website. A website is a fact from the authoritative source, not a
 *    model judgment, so it runs here - synchronously, no batch, no LLM - ahead of
 *    the tag/recon miner, whose input is exactly this site. Covers EVERY type,
 *    `other` included (a shuttle company has no filter tags but still wants its
 *    site linked).
 *
 * 2. FILTER-LESS DRAIN. A vendor whose type has no filter vocabulary (currently
 *    `other`) gets no model call, so it never gets a result, so daily-apply never
 *    clears its filters_dirty_at. Left set, it re-exports every run forever - and
 *    if it has a place_id but no findable website, it re-probes Places every run
 *    too (a daily bill). This step is its only handler, so it clears the flag
 *    here (compare-and-clear <= the export watermark, so a recon entry that landed
 *    mid-run keeps a newer stamp and survives to the next run).
 *
 * Reads  data/reconcile/<work>/vendors.jsonl, watermark.json (from daily-export)
 * Writes vendors.website + vendors.filters_dirty_at (on --apply), websites.jsonl
 *
 * Dry run by default - it mutates user-visible data. Only ever sets a website on
 * a website-null row (re-checked live), so a re-run after a partial apply just
 * re-probes the ones still missing and nothing is clobbered.
 *
 * Cost: one Place Details Enterprise call per website candidate (field mask id +
 * websiteUri; $20/1k, 1,000 free/mo - see docs/google-places-cost.md). No cache:
 * the daily dirty set is a trickle, a website found is written (not re-probed),
 * and a filter-less vendor is drained (not re-probed). Without
 * GOOGLE_PLACES_API_KEY the backfill is skipped but the drain still runs - both
 * are additive and the rest of the reconcile does not depend on the site.
 */

import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { loadEnv, serviceClient, workdir, readJsonl, arg, has } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: daily-websites.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");

loadEnv();
const apiKey = process.env.GOOGLE_PLACES_API_KEY;

const dir = workdir(WORK);
const rows = readJsonl(join(dir, "vendors.jsonl"));
const hasVocab = (v) => (VENDOR_FILTERS[v.vendor_type] ?? []).length > 0;

const candidates = apiKey ? rows.filter((v) => !v.website && v.google_place_id) : [];
const filterless = rows.filter((v) => !hasVocab(v));
console.log(
  `dirty vendors: ${rows.length}; website candidates: ${candidates.length}; ` +
    `filter-less (drain): ${filterless.length}`,
);
if (!apiKey) console.log("No GOOGLE_PLACES_API_KEY set; website backfill skipped (drain still runs).");

const db = APPLY ? serviceClient() : null;

// --- 1. website backfill ----------------------------------------------------

/** One Place Details lookup for the vendor website. Returns the URL or null. */
async function placeWebsite(placeId) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "id,websiteUri" } },
  );
  if (!res.ok) {
    console.error(`  places details ${placeId}: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data?.websiteUri ?? null;
}

let found = 0;
let wrote = 0;
let calls = 0;
const results = [];

for (const v of candidates) {
  calls++;
  const website = await placeWebsite(v.google_place_id);
  results.push({ id: v.id, name: v.name, website });
  if (!website) continue;
  found++;
  console.log(`  ${v.name}: ${website}`);
  if (APPLY) {
    // Re-check `website is null` in the same write so a site that arrived since
    // the export (or a manual edit) is never overwritten.
    const { error } = await db
      .from("vendors")
      .update({ website })
      .eq("id", v.id)
      .is("website", null);
    if (error) console.error(`    write failed: ${error.message}`);
    else wrote++;
  }
}

writeFileSync(join(dir, "websites.jsonl"), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(
  `\nfound ${found} website(s) across ${candidates.length} candidate(s); ` +
    (APPLY ? `wrote ${wrote}.` : "dry run - nothing written."),
);
if (calls)
  console.log(`Places: ${calls} Place Details Enterprise call(s) (websiteUri; $20/1k, 1,000 free/mo).`);

// --- 2. filter-less drain ---------------------------------------------------

if (filterless.length) {
  const { watermark } = JSON.parse(readFileSync(join(dir, "watermark.json"), "utf8"));
  if (APPLY && watermark) {
    let cleared = 0;
    for (const v of filterless) {
      const { error } = await db
        .from("vendors")
        .update({ filters_dirty_at: null })
        .eq("id", v.id)
        .lte("filters_dirty_at", watermark);
      if (error) console.error(`  drain ${v.name}: ${error.message}`);
      else cleared++;
    }
    console.log(
      `drained ${cleared}/${filterless.length} filter-less dirty vendor(s) ` +
        `(no tag reconcile applies): ${[...new Set(filterless.map((v) => v.vendor_type))].join(", ")}`,
    );
  } else {
    console.log(`${filterless.length} filter-less dirty vendor(s) would be drained on --apply.`);
  }
}
