#!/usr/bin/env node
/**
 * Phase 1 - export the pass input, and snapshot everything it may overwrite.
 *
 *   node scripts/reconcile/export.mjs --work co-all [--type venue]
 *
 * Writes into `data/reconcile/<work>/`:
 *
 *   snapshot/vendors-filters.jsonl   every vendor's filters + provenance, as of now
 *   snapshot/recon-entries.jsonl     every active recon entry, full text, as of now
 *   vendors.jsonl                    the pass input: one row per actionable vendor
 *   export-report.txt                counts, and who is NOT actionable and why
 *
 * THE SNAPSHOT IS THE ONLY UNDO. `recon_entries` keeps no history, so an edit
 * destroys the prior wording permanently, and this pass edits bot prose in bulk
 * on model judgment - which, unlike migration 0036, cannot be re-derived and
 * replayed. Nothing downstream writes to the database until these files exist.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { serviceClient, fetchAll, workdir, writeJsonl, arg } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: export.mjs --work <name> [--type <vendor_type>]");
  process.exit(1);
}
const TYPE = arg("type");

const db = serviceClient();
const dir = workdir(WORK);

console.log(`Exporting to ${dir}${TYPE ? ` (type: ${TYPE})` : ""}\n`);

// --- read ------------------------------------------------------------------
// Every read pages; see fetchAll for why a short list here is silent, not an error.

const vendors = await fetchAll(
  db,
  "vendors",
  "id,name,vendor_type,city,region,filters,filters_meta,filters_source,filters_updated_at",
  (q) => (TYPE ? q.eq("vendor_type", TYPE) : q),
);
console.log(`vendors:       ${vendors.length}`);

const entries = await fetchAll(
  db,
  "recon_entries",
  "id,vendor_id,author_id,recon_type,price_text,price_details,notes,service_region,recon_collected_month,recon_collected_year,status,created_at,updated_at",
  (q) => q.eq("status", "active"),
);
console.log(`recon entries: ${entries.length}`);

const profiles = await fetchAll(db, "profiles", "id,username,is_bot");
const bots = new Map(profiles.map((p) => [p.id, p]));
console.log(`profiles:      ${profiles.length} (${profiles.filter((p) => p.is_bot).length} bot)\n`);

// --- snapshot BEFORE anything else ------------------------------------------
// Written first and unconditionally. A later phase that cannot restore is a
// phase that must not run.

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
console.log(`snapshot written: ${vendors.length} filter rows, ${entries.length} entries`);

// --- assemble ---------------------------------------------------------------

const byVendor = new Map();
for (const e of entries) {
  if (!byVendor.has(e.vendor_id)) byVendor.set(e.vendor_id, []);
  const author = bots.get(e.author_id);
  byVendor.get(e.vendor_id).push({
    ...e,
    is_bot: Boolean(author?.is_bot),
    username: author?.username ?? null,
  });
}

const populated = (f) =>
  f && typeof f === "object"
    ? Object.entries(f).filter(
        ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
      ).length
    : 0;

const rows = [];
const skipped = { noEntries: [], noBotEntry: [] };

for (const v of vendors) {
  const mine = byVendor.get(v.id) ?? [];
  const botEntries = mine.filter((e) => e.is_bot);

  // Edit-only, by decision (Kiara, 2026-08-09): with no research in scope, a
  // newly created entry would be nothing but existing tags restated as prose -
  // the thinnest content in the corpus, attributed to a persona who never
  // observed any of it. A vendor with no bot entry is reported, not written.
  if (mine.length === 0) {
    skipped.noEntries.push(v);
    continue;
  }
  if (botEntries.length === 0) {
    skipped.noBotEntry.push(v);
    continue;
  }
  // A vendor with bot entries but zero tags is still actionable: Direction B
  // reads its recon text and may tag it. There is no tags-empty skip.

  rows.push({
    id: v.id,
    name: v.name,
    vendor_type: v.vendor_type,
    city: v.city,
    region: v.region,
    filters: v.filters ?? {},
    filters_meta: v.filters_meta ?? {},
    filters_source: v.filters_source,
    tag_count: populated(v.filters),
    entries: mine.map((e) => ({
      id: e.id,
      author_id: e.author_id,
      username: e.username,
      is_bot: e.is_bot,
      recon_type: e.recon_type,
      price_text: e.price_text,
      price_details: e.price_details,
      notes: e.notes,
      service_region: e.service_region,
      collected: [e.recon_collected_month, e.recon_collected_year],
      // Length drives which entry an append lands on: shortest first, so tags
      // spread across entries instead of bloating whichever came back first.
      length: (e.notes || "").length + (e.price_details || "").length,
    })),
  });
}

writeJsonl(join(dir, "vendors.jsonl"), rows);

// --- report -----------------------------------------------------------------

const byType = {};
for (const r of rows) {
  const t = (byType[r.vendor_type] ??= { vendors: 0, tags: 0, entries: 0, botEntries: 0 });
  t.vendors++;
  t.tags += r.tag_count;
  t.entries += r.entries.length;
  t.botEntries += r.entries.filter((e) => e.is_bot).length;
}

const report = [
  `Reconciliation export - ${WORK}${TYPE ? ` (${TYPE})` : ""}`,
  new Date().toISOString(),
  "",
  `Actionable vendors: ${rows.length}`,
  "",
  "type       vendors   tags  entries  bot-entries  tags/vendor",
  ...Object.entries(byType)
    .sort((a, b) => b[1].vendors - a[1].vendors)
    .map(
      ([t, s]) =>
        `${t.padEnd(10)} ${String(s.vendors).padStart(7)} ${String(s.tags).padStart(6)} ` +
        `${String(s.entries).padStart(8)} ${String(s.botEntries).padStart(12)} ` +
        `${(s.tags / s.vendors).toFixed(1).padStart(12)}`,
    ),
  "",
  "NOT actionable (reported, never written - see edit-only decision above):",
  `  no recon entries at all:      ${skipped.noEntries.length}`,
  `  entries exist but none bot:   ${skipped.noBotEntry.length}`,
  "",
  "A vendor with only human entries is deliberately untouched: a real person's",
  "words are theirs, and the is_bot gate is the same line migration 0036 drew.",
  "",
  "Vendors with entries but no bot entry:",
  ...skipped.noBotEntry.slice(0, 40).map((v) => `  ${v.name} (${v.vendor_type}, ${v.city})`),
  skipped.noBotEntry.length > 40 ? `  ... and ${skipped.noBotEntry.length - 40} more` : null,
]
  .filter((l) => l !== null)
  .join("\n");

writeFileSync(join(dir, "export-report.txt"), report + "\n");
console.log("\n" + report);
console.log(`\nWrote ${rows.length} actionable vendors to ${join(dir, "vendors.jsonl")}`);
