#!/usr/bin/env node
/**
 * Undo - put `vendors.filters` and `recon_entries` back to the snapshot taken
 * by export.mjs.
 *
 *   node scripts/reconcile/restore.mjs --work co-all            (dry run)
 *   node scripts/reconcile/restore.mjs --work co-all --apply
 *
 * Dry run is the DEFAULT here, the opposite of backfill-vendor-filters.mjs.
 * That script derives its writes from a committed file and can be re-run at
 * will; this one overwrites live prose with a copy from disk, so the safe mode
 * is the one you get without thinking.
 *
 * Restores only rows that actually differ from what is in the database now, and
 * names every one, so the output doubles as the record of what the pass changed.
 *
 * Deliberately NOT limited to rows this pass touched: the snapshot is a
 * point-in-time copy of the whole corpus. If something else edited a row in the
 * meantime, restoring would clobber that too - which is why it lists the rows
 * and requires --apply rather than restoring silently.
 */

import { join } from "node:path";
import { serviceClient, fetchAll, workdir, readJsonl, arg, has } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: restore.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");

const db = serviceClient();
const dir = workdir(WORK);

const snapVendors = readJsonl(join(dir, "snapshot/vendors-filters.jsonl"));
const snapEntries = readJsonl(join(dir, "snapshot/recon-entries.jsonl"));
console.log(
  `Snapshot: ${snapVendors.length} filter rows, ${snapEntries.length} recon entries\n`,
);

const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// --- what drifted from the snapshot ----------------------------------------

const liveVendors = new Map(
  (
    await fetchAll(
      db,
      "vendors",
      "id,filters,filters_meta,filters_source,filters_updated_at",
    )
  ).map((v) => [v.id, v]),
);

const liveEntries = new Map(
  (
    await fetchAll(
      db,
      "recon_entries",
      "id,notes,price_text,price_details,recon_collected_month,recon_collected_year,updated_at",
    )
  ).map((e) => [e.id, e]),
);

const vendorFixes = snapVendors.filter((s) => {
  const live = liveVendors.get(s.id);
  return (
    live &&
    (!eq(live.filters, s.filters) ||
      !eq(live.filters_meta, s.filters_meta) ||
      live.filters_source !== s.filters_source)
  );
});

const entryFixes = snapEntries.filter((s) => {
  const live = liveEntries.get(s.id);
  return (
    live &&
    (live.notes !== s.notes ||
      live.price_text !== s.price_text ||
      live.price_details !== s.price_details ||
      live.recon_collected_month !== s.recon_collected_month ||
      live.recon_collected_year !== s.recon_collected_year)
  );
});

const goneEntries = snapEntries.filter((s) => !liveEntries.has(s.id));

console.log(`vendors with changed filters: ${vendorFixes.length}`);
console.log(`recon entries with changed text: ${entryFixes.length}`);
if (goneEntries.length) {
  // Nothing in this pass deletes entries, so this means something else did.
  console.log(
    `\nWARNING: ${goneEntries.length} snapshotted entries no longer exist. ` +
      `This pass never deletes, so another process removed them; restore cannot recreate them.`,
  );
}

for (const e of entryFixes.slice(0, 25)) {
  const live = liveEntries.get(e.id);
  console.log(`\n  entry ${e.id}`);
  if (live.notes !== e.notes) {
    console.log(`    notes now:  ${(live.notes || "").slice(0, 110)}`);
    console.log(`    snapshot:   ${(e.notes || "").slice(0, 110)}`);
  }
  if (live.price_text !== e.price_text)
    console.log(`    price_text: ${live.price_text} <- ${e.price_text}`);
}
if (entryFixes.length > 25) console.log(`\n  ... and ${entryFixes.length - 25} more`);

if (!APPLY) {
  console.log(`\nDry run. Re-run with --apply to restore the above.`);
  process.exit(0);
}

// --- restore ----------------------------------------------------------------

let ok = 0;
for (const s of vendorFixes) {
  const { error } = await db
    .from("vendors")
    .update({
      filters: s.filters,
      filters_meta: s.filters_meta,
      filters_source: s.filters_source,
      filters_updated_at: s.filters_updated_at,
    })
    .eq("id", s.id);
  if (error) console.error(`  vendor ${s.id}: ${error.message}`);
  else ok++;
}
console.log(`\nrestored filters on ${ok}/${vendorFixes.length} vendors`);

ok = 0;
for (const s of entryFixes) {
  const { error } = await db
    .from("recon_entries")
    .update({
      notes: s.notes,
      price_text: s.price_text,
      price_details: s.price_details,
      recon_collected_month: s.recon_collected_month,
      recon_collected_year: s.recon_collected_year,
      // updated_at goes back to its snapshot value, including null - the column
      // means "this entry has been edited", so a restored entry should not
      // claim an edit that has been undone.
      updated_at: s.updated_at,
    })
    .eq("id", s.id);
  if (error) console.error(`  entry ${s.id}: ${error.message}`);
  else ok++;
}
console.log(`restored text on ${ok}/${entryFixes.length} recon entries`);
