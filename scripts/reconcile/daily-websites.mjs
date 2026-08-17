#!/usr/bin/env node
/**
 * On-write reconcile - website backfill (deterministic, Google Places).
 *
 *   node scripts/reconcile/daily-websites.mjs --work <name>            (dry run)
 *   node scripts/reconcile/daily-websites.mjs --work <name> --apply
 *
 * For each dirty vendor that has no website but does carry a google_place_id,
 * ask Google Places for its websiteUri and set vendors.website. A website is a
 * fact from the authoritative source, not a model judgment, so this runs here -
 * synchronously, no batch, no LLM - ahead of the tag/recon miner, whose input is
 * exactly this website. It covers EVERY type, `other` included: `other` has no
 * filter tags to mine, but a shuttle company still wants its site linked.
 *
 * Reads  data/reconcile/<work>/vendors.jsonl   (written by daily-export.mjs)
 * Writes vendors.website (on --apply) + websites.jsonl (what it found, per row)
 *
 * Dry run by default - it mutates user-visible data. --apply writes. Only ever
 * touches website-null rows, and the write re-checks `website is null` live, so a
 * re-run after a partial apply just re-probes the ones still missing and nothing
 * is clobbered.
 *
 * Cost: one Place Details Enterprise call per candidate (field mask id +
 * websiteUri; $20/1k, 1,000 free/mo - see docs/google-places-cost.md). No cache:
 * the daily dirty set is a trickle, and a website found is written, so it is not
 * re-probed. Without GOOGLE_PLACES_API_KEY it skips cleanly - the backfill is
 * additive and the rest of the reconcile does not depend on it.
 */

import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { loadEnv, serviceClient, workdir, readJsonl, arg, has } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: daily-websites.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");

loadEnv();
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.log("No GOOGLE_PLACES_API_KEY set; skipping website backfill (additive step).");
  process.exit(0);
}

const dir = workdir(WORK);
const rows = readJsonl(join(dir, "vendors.jsonl"));
const candidates = rows.filter((v) => !v.website && v.google_place_id);
console.log(
  `dirty vendors: ${rows.length}; missing website and have a place_id: ${candidates.length}`,
);
if (candidates.length === 0) {
  writeFileSync(join(dir, "websites.jsonl"), "");
  console.log("Nothing to backfill.");
  process.exit(0);
}

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

const db = APPLY ? serviceClient() : null;
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
console.log(
  `Places: ${calls} Place Details Enterprise call(s) (websiteUri; $20/1k, 1,000 free/mo).`,
);
