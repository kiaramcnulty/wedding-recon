#!/usr/bin/env node
/**
 * Phase 5 - write the gated output to the database.
 *
 *   node scripts/reconcile/apply.mjs --work co-all           (dry run)
 *   node scripts/reconcile/apply.mjs --work co-all --apply
 *
 * Dry run by default. Resumable: every success is logged to applied.jsonl and
 * skipped on a re-run, so an interrupted apply can be restarted without writing
 * anything twice.
 *
 * Filters are merged with a fresh read of the row rather than the export, so a
 * value that changed since the export is not clobbered by a stale copy. Keys
 * whose provenance is `manual` are never touched: precedence is manual over
 * recon over extraction, and a human setting a value through the app outranks
 * anything this pass concludes.
 *
 * GUARDS (2026-10-02, after the audit of the 2026-08-09/11 run - see
 * docs/bot-recon-quality-plan.md item 1). That run appended a sentence for
 * every undocumented tag with nothing but the tag behind it, and some were
 * false. So, re-checked HERE and not only in gate.mjs, because accepted.jsonl
 * is a file anyone can edit and the apply is the guarantee:
 *   - every appended clause carries `evidence` - verbatim quotes from the
 *     vendor's harvested pages/reviews (evidence.mjs), never from the tag or
 *     the model's own text - and every number it states appears in them;
 *   - it passes the shared prose gates (prose-gate.mjs) and cannot introduce a
 *     MONEY + "no price posted" contradiction into the card;
 *   - an edit that fails takes its tags with it: a filter write for a key the
 *     failed edit `documents` is not written (Kiara, 2026-10-02: an
 *     unconfirmable fact gets neither the sentence nor the tag), and existing
 *     tags left undocumented are listed in unconfirmed-tags.jsonl for review;
 *   - a tag read off a BOT entry needs source evidence too, and brand/chain
 *     wording may not set a property tag (item 15);
 *   - nothing is written until the touched rows are snapshotted, from a fresh
 *     read, into the MAIN checkout (audit.mjs), and every field write is logged
 *     to its append-only audit.jsonl. restore.mjs --run <id> undoes the run.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { serviceClient, workdir, readJsonl, writeJsonl, arg, has, MONEY } from "./lib.mjs";
import { WriteRun, auditNote } from "./audit.mjs";
import { reviewProseChange, reviewTagWrite } from "./evidence.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: apply.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const dir = workdir(WORK);

const accepted = readJsonl(join(dir, "accepted.jsonl"));
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));

const logPath = join(dir, "applied.jsonl");
const done = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l).vendor_id)
    : [],
);
if (done.size) console.log(`Resuming: ${done.size} vendors already applied\n`);

/**
 * A collected month for a price that was not collected when the entry was.
 *
 * These dates were always synthetic on bot entries (Kiara, 2026-08-09), so
 * moving one is not corrupting a real measurement. Derived from the entry id so
 * a re-run lands on the same month, and capped at the current month - a random
 * month across the whole year puts a third of them in the future.
 */
const NOW = new Date();
function collectedMonth(entryId) {
  const h = parseInt(createHash("sha256").update(entryId).digest("hex").slice(0, 8), 16);
  return (h % (NOW.getMonth() + 1)) + 1;
}

// --- plan: every check runs before any write --------------------------------

const plans = [];
const rejected = [];
const unconfirmed = [];

for (const row of accepted) {
  if (done.has(row.vendor_id)) continue;
  const v = vendors.get(row.vendor_id);
  if (!v) {
    rejected.push({ vendor_id: row.vendor_id, what: "vendor", errors: ["not in vendors.jsonl"] });
    continue;
  }
  const entries = new Map(v.entries.map((e) => [e.id, e]));
  const cards = new Map(); // entry id -> card as this run leaves it, so edits compound
  const edits = [];
  const failedKeys = new Set();

  for (const e of row.recon_edits ?? []) {
    // A documented price ($-bearing clause) belongs where the priced sort and
    // the card read it. notes is invisible to hasPriceQuote(), so a price clause
    // the model routed to notes is redirected to price_details.
    let field = e.field;
    if (MONEY.test(e.append ?? "") && field === "notes") {
      console.log(`  ${v.name} / ${e.entry_id}: price clause redirected notes -> price_details`);
      field = "price_details";
    }
    const entry = entries.get(e.entry_id);
    const card = cards.get(e.entry_id) ?? (entry && { notes: entry.notes ?? "", price_text: entry.price_text ?? "", price_details: entry.price_details ?? "" });
    const r = reviewProseChange({
      vendorId: v.id,
      entry,
      card,
      change: { kind: "append", field, text: e.append, evidence: e.evidence },
    });
    if (r.errors.length) {
      rejected.push({ vendor_id: v.id, name: v.name, what: `edit ${e.entry_id}.${field}`, text: e.append, errors: r.errors });
      for (const k of e.documents ?? []) failedKeys.add(k);
      continue;
    }
    cards.set(e.entry_id, r.after);
    edits.push({ entry_id: e.entry_id, field, append: e.append, prev: card[field] ?? "", next: r.after[field], documents: e.documents ?? [], evidence: r.verified });
  }

  // Tags the failed edits were meant to document stay undocumented. Not
  // deleted here (a dry-run-by-default pass should not destroy on a failed
  // check), but listed so the remediation change list picks them up.
  for (const k of failedKeys)
    if (v.filters?.[k] != null) unconfirmed.push({ vendor_id: v.id, name: v.name, key: k, value: v.filters[k], reason: "the edit documenting it had no confirmable source" });

  const writes = [];
  for (const w of row.filter_writes ?? []) {
    if (failedKeys.has(w.key)) {
      rejected.push({ vendor_id: v.id, name: v.name, what: `tag ${w.key}`, errors: ["its documenting edit was rejected - an unconfirmable fact gets neither the sentence nor the tag"] });
      continue;
    }
    const r = reviewTagWrite({ vendorId: v.id, write: w, entry: entries.get(w.entry_id) });
    if (r.errors.length) {
      rejected.push({ vendor_id: v.id, name: v.name, what: `tag ${w.key}`, errors: r.errors });
      continue;
    }
    writes.push({ ...w, verified: r.verified });
  }

  plans.push({ v, edits, writes });
}

writeJsonl(join(dir, "apply-rejected.jsonl"), rejected);
writeJsonl(join(dir, "unconfirmed-tags.jsonl"), unconfirmed);

// --- write -------------------------------------------------------------------

const db = APPLY ? serviceClient() : null;
const run = new WriteRun({ work: WORK, script: "apply", apply: APPLY, db });
// Snapshot every row this run may touch, BEFORE the first write. WriteRun
// refuses any write to a row that is not in it.
await run.snapshot("recon_entries", plans.flatMap((p) => p.edits.map((e) => e.entry_id)));
await run.snapshot("vendors", plans.filter((p) => p.writes.length).map((p) => p.v.id));
for (const r of rejected) auditNote(run, { op: "rejected", vendor_id: r.vendor_id, what: r.what, errors: r.errors });

let edited = 0;
let tagged = 0;
let skippedManual = 0;

for (const { v, edits, writes } of plans) {
  for (const e of edits) {
    // The run's own last-known value, not the export: a second append to the
    // same field must build on the first (the old loop rebuilt each from the
    // export text, so a second append silently dropped the first).
    const live = APPLY ? run.row("recon_entries", e.entry_id) : null;
    if (APPLY && !live) {
      console.error(`  entry ${e.entry_id}: gone since export - skipped`);
      continue;
    }
    if (APPLY && (live[e.field] ?? "") !== e.prev) {
      // The field is not what the reviewed card assumed (someone edited it
      // since export). Appending now would review one text and write another.
      console.error(`  entry ${e.entry_id}.${e.field}: changed since export - skipped, re-run the pass`);
      continue;
    }
    const patch = { [e.field]: e.next, updated_at: new Date().toISOString() };
    if (e.field === "price_details" || e.documents.some((k) => /price/.test(k))) {
      patch.recon_collected_month = collectedMonth(e.entry_id);
      patch.recon_collected_year = NOW.getFullYear();
    }
    if (!APPLY) {
      console.log(`  ${v.name} / ${e.entry_id} .${e.field}`);
      console.log(`    + ${e.append}`);
      for (const q of e.evidence) console.log(`      evidence [${q.source}]: "${q.quote}"`);
    } else {
      const { error } = await run.update("recon_entries", e.entry_id, patch, {
        evidence: e.evidence,
        reason: `direction A: documents ${e.documents.join(", ") || "(no key named)"}`,
      });
      if (error) {
        console.error(`  entry ${e.entry_id}: ${error.message}`);
        continue;
      }
    }
    edited++;
  }

  if (!writes.length) {
    if (APPLY) appendFileSync(logPath, JSON.stringify({ vendor_id: v.id, run_id: run.runId }) + "\n");
    continue;
  }
  // The snapshot read IS the fresh read: a value that changed since the export
  // is merged against, not clobbered.
  const live = APPLY ? run.row("vendors", v.id) : { filters: v.filters, filters_meta: v.filters_meta, filters_source: v.filters_source };
  if (!live) {
    console.error(`  vendor ${v.id}: gone since export`);
    continue;
  }
  const filters = { ...(live.filters ?? {}) };
  const meta = { ...(live.filters_meta ?? {}) };
  const stamp = new Date().toISOString();
  let changed = 0;
  const evidence = [];
  for (const w of writes) {
    if (meta[w.key]?.source === "manual") {
      skippedManual++;
      continue;
    }
    // Growing a list keeps what is already there; a set union, because
    // replacing would silently drop values the extraction found.
    if (Array.isArray(filters[w.key]) && Array.isArray(w.value)) {
      filters[w.key] = [...new Set([...filters[w.key], ...w.value])];
    } else {
      filters[w.key] = w.value;
    }
    meta[w.key] = { source: "recon", updated_at: stamp, quote: w.quote, entry_id: w.entry_id };
    if (w.basis) filters.price_basis ??= w.basis;
    if (w.kind) filters.price_kind ??= w.kind;
    evidence.push({ key: w.key, quote: w.quote, source: `recon_entries/${w.entry_id}` }, ...w.verified.map((x) => ({ key: w.key, ...x })));
    changed++;
  }
  if (changed) {
    if (!APPLY) {
      console.log(`  ${v.name}: ${writes.map((w) => `${w.key}=${JSON.stringify(w.value)}`).join(", ")}`);
    } else {
      // Bump the ROW-level source too, not just the per-key meta. That column
      // is what backfill-vendor-filters.mjs gates on: it re-derives and
      // overwrites any row still marked extraction. Precedence is manual over
      // recon over extraction, so a row a human set (manual) is never downgraded.
      const nextSource = live.filters_source === "manual" ? "manual" : "recon";
      const { error } = await run.update(
        "vendors",
        v.id,
        { filters, filters_meta: meta, filters_source: nextSource, filters_updated_at: stamp },
        { evidence, reason: "direction B: tag from recon" },
      );
      if (error) {
        console.error(`  vendor ${v.id}: ${error.message}`);
        continue;
      }
    }
    tagged += changed;
  }
  if (APPLY) appendFileSync(logPath, JSON.stringify({ vendor_id: v.id, run_id: run.runId }) + "\n");
}

console.log(
  [
    "",
    APPLY ? "APPLIED" : "DRY RUN - nothing written",
    `  recon entries edited: ${edited}`,
    `  filter tags written:  ${tagged}`,
    `  skipped (manual):     ${skippedManual}`,
    `  rejected by guards:   ${rejected.length}  (apply-rejected.jsonl)`,
    `  tags left unconfirmed:${String(unconfirmed.length).padStart(4)}  (unconfirmed-tags.jsonl - review: drop or source them)`,
    "",
    run.where(),
    APPLY ? "" : "\nRe-run with --apply to write.",
  ].join("\n"),
);
for (const r of rejected.slice(0, 40)) console.log(`  REJECT ${r.name ?? r.vendor_id} ${r.what}: ${r.errors.join("; ")}`);
