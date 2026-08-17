#!/usr/bin/env node
/**
 * On-write reconcile, phase 1 - snapshot and export the DIRTY vendors.
 *
 *   node scripts/reconcile/daily-export.mjs --work daily-20260812
 *
 * This is the tags-only sibling of export.mjs. It differs in two ways that
 * matter:
 *
 *   1. Selection is `vendors.filters_dirty_at is not null` - the vendors a recon
 *      write has touched since the last run (migration 0038 stamps them) - not a
 *      whole region.
 *
 *   2. It is NOT edit-only. The offline pass appends prose to BOT entries and so
 *      skips a vendor with only human entries. This pass writes TAGS from recon
 *      and never edits prose, so a couple's own entry is a first-class input: a
 *      human-only vendor is exported and reconciled like any other. is_bot is
 *      still carried, but for contradiction WEIGHTING, not for edit permission.
 *
 * Writes into data/reconcile/<work>/:
 *   snapshot/vendors-filters.jsonl   filters + provenance, as of now (the undo)
 *   snapshot/recon-entries.jsonl     active entries (for restore.mjs symmetry)
 *   vendors.jsonl                    one row per dirty vendor, all active entries
 *   watermark.json                   max filters_dirty_at seen + the vendor ids
 *   export-report.txt
 *
 * THE SNAPSHOT IS THE ONLY UNDO. This pass overwrites vendors.filters on model
 * judgment; restore.mjs --work <name> puts it back.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { serviceClient, fetchAll, workdir, writeJsonl, arg } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: daily-export.mjs --work <name>");
  process.exit(1);
}

const db = serviceClient();
const dir = workdir(WORK);
console.log(`On-write reconcile export -> ${dir}\n`);

// --- dirty vendors ----------------------------------------------------------

const vendors = await fetchAll(
  db,
  "vendors",
  "id,name,vendor_type,city,region,website,google_place_id,filters,filters_meta,filters_source,filters_updated_at,filters_dirty_at",
  (q) => q.not("filters_dirty_at", "is", null),
);
console.log(`dirty vendors: ${vendors.length}`);

if (vendors.length === 0) {
  // Nothing to do. Write an empty pass input so downstream phases no-op cleanly
  // rather than dying on a missing file, and record an empty watermark.
  writeJsonl(join(dir, "vendors.jsonl"), []);
  writeJsonl(join(dir, "snapshot/vendors-filters.jsonl"), []);
  writeJsonl(join(dir, "snapshot/recon-entries.jsonl"), []);
  writeFileSync(join(dir, "watermark.json"), JSON.stringify({ watermark: null, ids: [] }));
  writeFileSync(join(dir, "export-report.txt"), "No dirty vendors.\n");
  console.log("Nothing dirty. Exiting clean.");
  process.exit(0);
}

const dirtyIds = vendors.map((v) => v.id);

// Watermark: the newest stamp in this batch. apply clears filters_dirty_at only
// where it is <= this, so a recon entry that lands mid-run keeps a newer stamp
// and survives to the next run instead of being cleared unprocessed.
const watermark = vendors
  .map((v) => v.filters_dirty_at)
  .reduce((a, b) => (a > b ? a : b));

// --- their active entries ---------------------------------------------------
// Fetch entries only for the dirty vendors, chunking the id list so a large
// dirty set cannot blow the PostgREST URL length limit.

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const entries = [];
for (const ids of chunk(dirtyIds, 200)) {
  const part = await fetchAll(
    db,
    "recon_entries",
    "id,vendor_id,author_id,recon_type,price_text,price_details,notes,service_region,recon_collected_month,recon_collected_year,status,created_at,updated_at",
    (q) => q.eq("status", "active").in("vendor_id", ids),
  );
  entries.push(...part);
}
console.log(`active entries: ${entries.length}`);

const profiles = await fetchAll(db, "profiles", "id,username,is_bot");
const who = new Map(profiles.map((p) => [p.id, p]));

// --- snapshot BEFORE anything else ------------------------------------------

writeJsonl(
  join(dir, "snapshot/vendors-filters.jsonl"),
  vendors.map((v) => ({
    id: v.id,
    filters: v.filters,
    filters_meta: v.filters_meta,
    filters_source: v.filters_source,
    filters_updated_at: v.filters_updated_at,
  })),
);
writeJsonl(join(dir, "snapshot/recon-entries.jsonl"), entries);
writeFileSync(
  join(dir, "watermark.json"),
  JSON.stringify({ watermark, ids: dirtyIds }, null, 2),
);
console.log(`snapshot + watermark written (watermark ${watermark})`);

// --- assemble the pass input ------------------------------------------------

const byVendor = new Map();
for (const e of entries) {
  if (!byVendor.has(e.vendor_id)) byVendor.set(e.vendor_id, []);
  const author = who.get(e.author_id);
  byVendor.get(e.vendor_id).push({
    id: e.id,
    author_id: e.author_id,
    username: author?.username ?? null,
    is_bot: Boolean(author?.is_bot),
    recon_type: e.recon_type,
    price_text: e.price_text,
    price_details: e.price_details,
    notes: e.notes,
    service_region: e.service_region,
    collected: [e.recon_collected_month, e.recon_collected_year],
  });
}

const rows = [];
const skippedNoEntries = [];
for (const v of vendors) {
  const mine = byVendor.get(v.id) ?? [];
  // A dirty vendor with no active entry left (its only entry was just deleted)
  // is still actionable: a tag whose sole evidence was that entry must be
  // retracted. So it is exported with an empty entry list, not skipped.
  if (mine.length === 0) skippedNoEntries.push(v);
  rows.push({
    id: v.id,
    name: v.name,
    vendor_type: v.vendor_type,
    city: v.city,
    region: v.region,
    website: v.website ?? null,
    google_place_id: v.google_place_id ?? null,
    filters: v.filters ?? {},
    filters_meta: v.filters_meta ?? {},
    filters_source: v.filters_source,
    entries: mine,
  });
}

writeJsonl(join(dir, "vendors.jsonl"), rows);

const humanOnly = rows.filter(
  (r) => r.entries.length > 0 && r.entries.every((e) => !e.is_bot),
).length;

const report = [
  `On-write reconcile export - ${WORK}`,
  new Date().toISOString(),
  "",
  `dirty vendors:            ${rows.length}`,
  `  human-only entries:     ${humanOnly}`,
  `  no active entry (retract candidates): ${skippedNoEntries.length}`,
  `watermark:                ${watermark}`,
  "",
  "Next: node scripts/reconcile/daily-build-calls.mjs --work " + WORK,
].join("\n");
writeFileSync(join(dir, "export-report.txt"), report + "\n");
console.log("\n" + report);
