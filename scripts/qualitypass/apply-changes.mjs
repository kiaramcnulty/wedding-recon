#!/usr/bin/env node
/**
 * Apply one reviewed change list from the 2026-10 bot-recon cleanup
 * (docs/bot-recon-quality-plan.md). Every cleanup write goes through here, so
 * every one gets the same guards and the same undo.
 *
 *   node scripts/qualitypass/apply-changes.mjs --list data/qualitypass/cleanup/<name>.jsonl          (dry run)
 *   node scripts/qualitypass/apply-changes.mjs --list data/qualitypass/cleanup/<name>.jsonl --apply
 *   undo: node scripts/reconcile/restore.mjs --work qualitypass-<name> --run <run_id> --apply
 *
 * A change list is JSONL, one row change per line:
 *   {"table": "recon_entries" | "vendors", "id": "<uuid>",
 *    "set":    {"<field>": <new value>, ...},
 *    "expect": {"<field>": <value the list was built against>, ...},
 *    "reason": "...", "evidence": [{"source": "...", "quote": "..."}]}
 *
 * Guards, all of them before the first write:
 *   - only fields restore.mjs can revert (audit.mjs SNAPSHOT_COLUMNS) and only
 *     the cleanup's own fields; vendor_type is not on the list (Kiara retypes);
 *   - recon_entries rows must be authored by an is_bot profile - a real
 *     person's words are never edited (same rule as migration 0036);
 *   - compare-and-set: every `expect` value must still match a FRESH read, so a
 *     list built against the 2026-10-02 export cannot overwrite a later edit;
 *   - prose fields pass the shared gates (prose-gate.mjs via guardProseEdit):
 *     the change may not introduce a banned phrase, tooling language, a dossier
 *     marker, an em dash or a price contradiction;
 *   - status may only move to "removed" (a soft delete: the row stays, restore
 *     can bring it back, and a takedown does not block resubmission - 0028).
 * Then WriteRun snapshots every touched row into the MAIN checkout and logs each
 * field write to its append-only audit, exactly as the reconcile writers do.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { serviceClient, arg, has } from "../reconcile/lib.mjs";
import { WriteRun, SNAPSHOT_COLUMNS } from "../reconcile/audit.mjs";
import { guardProseEdit } from "../reconcile/evidence.mjs";

const LIST = arg("list");
if (!LIST) {
  console.error("Usage: apply-changes.mjs --list <change-list.jsonl> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const NAME = basename(LIST).replace(/\.jsonl$/, "");
const WORK = `qualitypass-${NAME}`;

const EDITABLE = {
  recon_entries: new Set(["notes", "price_text", "price_details", "service_region", "recon_collected_month", "recon_collected_year", "status"]),
  vendors: new Set(["name", "website", "filters", "filters_meta"]),
};
const PROSE = ["notes", "price_text", "price_details"];

const changes = readFileSync(LIST, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l, i) => {
    try {
      return { ...JSON.parse(l), line: i + 1 };
    } catch {
      console.error(`${LIST}:${i + 1}: not JSON`);
      process.exit(1);
    }
  });

const problems = [];
for (const c of changes) {
  const at = `line ${c.line} (${c.table} ${c.id})`;
  if (!EDITABLE[c.table]) problems.push(`${at}: table not editable here`);
  else
    for (const f of Object.keys(c.set ?? {})) {
      if (!EDITABLE[c.table].has(f) || !SNAPSHOT_COLUMNS[c.table].split(",").includes(f))
        problems.push(`${at}: field "${f}" is not editable by the cleanup`);
    }
  if (!c.reason) problems.push(`${at}: no reason`);
  if (!c.set || !Object.keys(c.set).length) problems.push(`${at}: empty set`);
  if (c.set?.status !== undefined && c.set.status !== "removed") problems.push(`${at}: status may only become "removed"`);
}
const ids = new Map();
for (const c of changes) {
  const k = `${c.table}|${c.id}`;
  if (ids.has(k)) problems.push(`line ${c.line}: ${k} also changed on line ${ids.get(k)} - merge them into one change`);
  ids.set(k, c.line);
}
if (problems.length) {
  console.error(`REFUSING ${LIST}:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

const db = serviceClient();
const run = new WriteRun({ work: WORK, script: "qualitypass-apply", apply: APPLY, db });

// Fresh read of every row (the dry run reads too, so it shows the real skips).
const fresh = { recon_entries: new Map(), vendors: new Map() };
for (const table of ["recon_entries", "vendors"]) {
  const want = changes.filter((c) => c.table === table).map((c) => c.id);
  const cols = table === "recon_entries" ? `${SNAPSHOT_COLUMNS[table]},profiles!inner(is_bot)` : SNAPSHOT_COLUMNS[table];
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await db.from(table).select(cols).in("id", want.slice(i, i + 200));
    if (error) {
      console.error(`read ${table}: ${error.message} - nothing written`);
      process.exit(1);
    }
    for (const r of data) fresh[table].set(r.id, r);
  }
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const plan = [];
const skipped = [];
for (const c of changes) {
  const row = fresh[c.table].get(c.id);
  const at = `${c.table} ${c.id}`;
  if (!row) { skipped.push(`${at}: not found`); continue; }
  if (c.table === "recon_entries" && !row.profiles?.is_bot) { skipped.push(`${at}: NOT a bot entry - refusing`); continue; }
  const drift = Object.entries(c.expect ?? {}).filter(([f, v]) => !same(row[f], v)).map(([f]) => f);
  if (drift.length) { skipped.push(`${at}: changed since the list was built (${drift.join(", ")}) - rebuild it`); continue; }
  if (Object.entries(c.set).every(([f, v]) => same(row[f], v))) { skipped.push(`${at}: already applied`); continue; }
  if (c.table === "recon_entries" && PROSE.some((f) => f in c.set)) {
    const before = Object.fromEntries(PROSE.map((f) => [f, row[f] ?? ""]));
    const after = { ...before, ...Object.fromEntries(PROSE.filter((f) => f in c.set).map((f) => [f, c.set[f] ?? ""])) };
    const added = PROSE.filter((f) => f in c.set).map((f) => c.set[f] ?? "").join(" ");
    const errs = guardProseEdit(before, after, added);
    if (errs.length) { skipped.push(`${at}: prose gate - ${errs.join("; ")}`); continue; }
  }
  plan.push(c);
}

console.log(`${LIST}: ${changes.length} change(s), ${plan.length} to write, ${skipped.length} skipped${APPLY ? "" : " (DRY RUN)"}`);
for (const s of skipped) console.log(`  skip ${s}`);

await run.snapshot("recon_entries", plan.filter((c) => c.table === "recon_entries").map((c) => c.id));
await run.snapshot("vendors", plan.filter((c) => c.table === "vendors").map((c) => c.id));

let ok = 0;
let failed = 0;
for (const c of plan) {
  const patch = { ...c.set };
  if (c.table === "recon_entries") patch.updated_at = new Date().toISOString();
  if (c.table === "vendors" && ("filters" in patch || "filters_meta" in patch)) patch.filters_updated_at = new Date().toISOString();
  const { error } = await run.update(c.table, c.id, patch, { evidence: c.evidence ?? [], reason: `${NAME}: ${c.reason}` });
  if (error) { failed++; console.error(`  FAILED ${c.table} ${c.id}: ${error.message}`); }
  else ok++;
}
console.log(APPLY ? `wrote ${ok}, failed ${failed}` : `would write ${plan.length}`);
console.log(run.where());
if (failed) process.exit(1);
