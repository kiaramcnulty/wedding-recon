#!/usr/bin/env node
/**
 * Undo - put `vendors.filters` and `recon_entries` back to a snapshot.
 *
 *   node scripts/reconcile/restore.mjs --work co-all                    (dry run)
 *   node scripts/reconcile/restore.mjs --work co-all --run <run_id> --apply
 *   node scripts/reconcile/restore.mjs --work co-all --runs --apply     (every run)
 *   node scripts/reconcile/restore.mjs --work co-all --from-export --apply
 *
 * TWO SNAPSHOT SOURCES.
 *
 *   Run snapshots (the default whenever any exist). Since 2026-10-02 every
 *   writer snapshots exactly the rows it touches, from a fresh read, into the
 *   MAIN checkout's data/reconcile/<work>/runs/<run_id>/ and logs each field
 *   write to audit.jsonl beside it (audit.mjs). That location survives the
 *   worktree being deleted - the way the 2026-08-09 Direction-A undo was lost.
 *   Restore here touches ONLY the fields the audit says the run wrote, on the
 *   rows it wrote them to, and deletes the rows the run inserted. With several
 *   runs, each row goes back to its EARLIEST snapshot (its pre-first-run state).
 *
 *   The export snapshot (--from-export, or when no run snapshot exists): the
 *   older whole-corpus copy export.mjs writes into the workdir. Broad by design,
 *   see below.
 *
 * Restore is itself a write, so it snapshots what it overwrites (a run named
 * "restore"), and a mistaken restore can be restored.
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
import { existsSync } from "node:fs";
import { serviceClient, fetchAll, workdir, readJsonl, arg, has } from "./lib.mjs";
import { WriteRun, loadRuns, loadAudit, SNAPSHOT_COLUMNS } from "./audit.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: restore.mjs --work <name> [--run <run_id> | --runs | --from-export] [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const RUN = arg("run");

const db = serviceClient();
const dir = workdir(WORK);

const allRuns = has("from-export") ? [] : loadRuns(WORK).filter((r) => r.meta.script !== "restore");
if (RUN && !allRuns.some((r) => r.run_id === RUN)) {
  console.error(`No run ${RUN} under the durable dir for ${WORK}. Runs: ${allRuns.map((r) => r.run_id).join(", ") || "(none)"}`);
  process.exit(1);
}
if (allRuns.length && !RUN && !has("runs")) {
  console.log(`Run snapshots for ${WORK}:`);
  for (const r of allRuns) console.log(`  ${r.run_id}  (${r.meta.script}, ${r.meta.started_at})`);
  console.log(`\nPass --run <run_id> for one run, --runs for all of them, or --from-export for the export snapshot.`);
  process.exit(0);
}

if (allRuns.length) {
  await restoreRuns(RUN ? allRuns.filter((r) => r.run_id === RUN) : allRuns);
  process.exit(0);
}

/**
 * Restore from durable run snapshots: only the fields each run's audit says it
 * wrote, each row to its earliest snapshot, and delete the run's inserts.
 */
async function restoreRuns(runs) {
  const audit = loadAudit(WORK);
  const ids = new Set(runs.map((r) => r.run_id));
  // table|row -> Set(fields written), from applied-or-pending update lines.
  const touched = new Map();
  const inserts = [];
  for (const a of audit) {
    if (!ids.has(a.run_id)) continue;
    if (a.op === "update" && a.field) {
      const k = `${a.table}|${a.row_id}`;
      if (!touched.has(k)) touched.set(k, new Set());
      touched.get(k).add(a.field);
    }
    if (a.op === "insert" && a.status === "applied" && a.row_id) inserts.push(a);
  }
  // Earliest snapshot per row: walk newest -> oldest so the oldest wins.
  const target = new Map();
  for (const r of [...runs].reverse())
    for (const [table, rows] of Object.entries(r.snapshots))
      for (const row of rows) if (!row.absent) target.set(`${table}|${row.id}`, row);

  const plan = [];
  for (const [k, fields] of touched) {
    const [table, id] = k.split("|");
    const snap = target.get(k);
    if (!snap) continue; // inserted by the run (absent before) - handled by delete below
    const { data: live, error } = await db.from(table).select(SNAPSHOT_COLUMNS[table]).eq("id", id).maybeSingle();
    if (error) throw new Error(`${table} ${id}: ${error.message}`);
    if (!live) {
      console.log(`  ${table} ${id}: no longer exists - cannot restore`);
      continue;
    }
    const patch = {};
    for (const f of fields) if (JSON.stringify(live[f] ?? null) !== JSON.stringify(snap[f] ?? null)) patch[f] = snap[f] ?? null;
    if (!Object.keys(patch).length) continue;
    // updated_at goes back too: the column means "this entry has been edited",
    // so a restored entry should not claim an edit that has been undone.
    if (table === "recon_entries") patch.updated_at = snap.updated_at ?? null;
    if (table === "vendors" && ("filters" in patch || "filters_meta" in patch)) patch.filters_updated_at = snap.filters_updated_at ?? null;
    plan.push({ table, id, patch, live });
  }

  console.log(`Restoring ${runs.length} run(s): ${runs.map((r) => r.run_id).join(", ")}`);
  console.log(`rows to revert: ${plan.length}; inserted rows to delete: ${inserts.length}\n`);
  for (const p of plan.slice(0, 40)) {
    console.log(`  ${p.table} ${p.id}`);
    for (const [f, v] of Object.entries(p.patch)) {
      if (f === "updated_at" || f === "filters_updated_at") continue;
      console.log(`    ${f}: ${JSON.stringify(p.live[f]).slice(0, 100)}`);
      console.log(`      <- ${JSON.stringify(v).slice(0, 100)}`);
    }
  }
  if (plan.length > 40) console.log(`  ... and ${plan.length - 40} more`);
  for (const i of inserts) console.log(`  DELETE ${i.table} ${i.row_id}`);

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to restore the above.`);
    return;
  }

  const run = new WriteRun({ work: WORK, script: "restore", apply: true, db });
  await run.snapshot("recon_entries", [...plan.filter((p) => p.table === "recon_entries").map((p) => p.id), ...inserts.filter((i) => i.table === "recon_entries").map((i) => i.row_id)]);
  await run.snapshot("vendors", [...plan.filter((p) => p.table === "vendors").map((p) => p.id), ...inserts.map((i) => i.vendor_id).filter(Boolean)]);
  let ok = 0;
  for (const p of plan) {
    const { error } = await run.update(p.table, p.id, p.patch, { reason: `restore of ${runs.map((r) => r.run_id).join(",")}` });
    if (error) console.error(`  ${p.table} ${p.id}: ${error.message}`);
    else ok++;
  }
  let del = 0;
  const vids = new Set();
  for (const i of inserts) {
    const { error } = await run.remove(i.table, i.row_id, { reason: `undo insert of run ${i.run_id}` });
    if (error) console.error(`  delete ${i.table} ${i.row_id}: ${error.message}`);
    else {
      del++;
      if (i.vendor_id) vids.add(i.vendor_id);
    }
  }
  // A removal marks the vendor dirty (migration 0040). Put the flag back to its
  // pre-run value (normally null - daily-apply clears it before the miner runs);
  // left as the delete set it, the next cron run re-mines the same fact and the
  // undo does not stick.
  for (const vid of vids)
    await run.update("vendors", vid, { filters_dirty_at: target.get(`vendors|${vid}`)?.filters_dirty_at ?? null }, {
      reason: "undo: reset the dirty flag the delete set",
    });
  console.log(`\nrestored ${ok}/${plan.length} rows, deleted ${del}/${inserts.length} inserted rows`);
  console.log(run.where());
}

console.log("No run snapshots for this work - restoring from the export snapshot.\n");

const snapVendors = readJsonl(join(dir, "snapshot/vendors-filters.jsonl"));
const snapEntries = readJsonl(join(dir, "snapshot/recon-entries.jsonl"));
// Entries the website miner INSERTED this run (daily-mine-apply). Reverting
// filters to the snapshot already removes the tags they wrote; these rows say
// which entries to delete to complete the undo.
const minedInserts = existsSync(join(dir, "mine-applied.jsonl"))
  ? readJsonl(join(dir, "mine-applied.jsonl"))
  : [];
console.log(
  `Snapshot: ${snapVendors.length} filter rows, ${snapEntries.length} recon entries` +
    (minedInserts.length ? `, ${minedInserts.length} mined entries to delete` : "") +
    "\n",
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

// Delete the entries the miner inserted this run, then clear the dirty flag the
// delete itself sets (a removal always marks dirty, per migration 0040) - without
// that, the very next cron run would re-mine the same fact and re-insert it, so
// the undo would not stick.
if (minedInserts.length) {
  let del = 0;
  const vids = new Set();
  for (const m of minedInserts) {
    const { error } = await db.from("recon_entries").delete().eq("id", m.entry_id);
    if (error) console.error(`  mined entry ${m.entry_id} (${m.vendor}): ${error.message}`);
    else {
      del++;
      vids.add(m.vendor_id);
    }
  }
  for (const vid of vids)
    await db.from("vendors").update({ filters_dirty_at: null }).eq("id", vid);
  console.log(
    `deleted ${del}/${minedInserts.length} mined entries and cleared ${vids.size} dirty flags`,
  );
}
