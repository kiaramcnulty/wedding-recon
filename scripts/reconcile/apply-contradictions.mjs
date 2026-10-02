#!/usr/bin/env node
/**
 * Apply the gated contradiction verdicts. The most destructive step in the
 * system: it deletes filter values and replaces live prose.
 *
 *   node scripts/reconcile/apply-contradictions.mjs --work co-adj              (dry run)
 *   node scripts/reconcile/apply-contradictions.mjs --work co-adj --apply
 *   node scripts/reconcile/apply-contradictions.mjs --work co-adj --only remove_tag --apply
 *
 * --only restricts to one verdict kind, so the safe edits (fix_recon) can go in
 * on their own and the destructive ones (remove_tag) can wait for a separate
 * hand-read. Dry run by default; resumable; restore.mjs --work <name> undoes it
 * from the fresh snapshot the co-adj export took.
 *
 * remove_tag deletes the key from BOTH filters and filters_meta - the tag was a
 * misextraction, so there is nothing to keep provenance for. correct_tag writes
 * the recon value with recon provenance. Both bump the row-level filters_source
 * off extraction so a backfill re-run cannot reinstate the bad value.
 *
 * GUARDS (2026-10-02, plan items 1 and 15), re-checked here because the gate
 * saw only the export and accepted-fix.jsonl is hand-filterable:
 *   fix_recon    the replacement needs a verbatim quote from a harvested source
 *                (the tag quote counts only if it is found in a page), passes
 *                the shared prose gates, and may not create a MONEY + "no price
 *                posted" card (the Et Voila contradiction). Numbers in it must
 *                appear in the evidence.
 *   correct_tag  the recon quote must be verbatim in its entry; off a BOT entry
 *                it also needs source evidence; brand/chain wording may not set
 *                a property tag; a number must be stated in its own quote.
 *   remove_tag   removing is the safe direction, so no evidence bar - but it is
 *                snapshotted and audited like every other write.
 * Every touched row is snapshotted from a fresh read into the MAIN checkout
 * before the first write (audit.mjs); restore.mjs --run <id> undoes the run.
 */

import { join } from "node:path";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { serviceClient, workdir, readJsonl, writeJsonl, arg, has } from "./lib.mjs";
import { WriteRun, auditNote } from "./audit.mjs";
import { reviewProseChange, reviewTagWrite, correctionEvidence } from "./evidence.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: apply-contradictions.mjs --work <name> [--only VERDICT] [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const ONLY = arg("only");
const dir = workdir(WORK);

// --accepted points at a hand-filtered subset (e.g. only the removals whose
// number is absent from their own quote). Defaults to the full gated set.
const ACCEPTED = arg("accepted", "accepted-fix.jsonl");
let accepted = readJsonl(join(dir, ACCEPTED));
if (ONLY) accepted = accepted.filter((r) => r.verdict === ONLY);
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));

const logPath = join(dir, `applied-fix${ONLY ? "-" + ONLY : ""}.jsonl`);
const key = (r) => `${r.vendor_id}|${r.key}|${r.verdict}`;
const done = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).k)
    : [],
);

const todo = accepted.filter((r) => !done.has(key(r)) && vendors.has(r.vendor_id));
const db = APPLY ? serviceClient() : null;
const run = new WriteRun({ work: WORK, script: `apply-contradictions${ONLY ? "-" + ONLY : ""}`, apply: APPLY, db });
await run.snapshot("recon_entries", todo.filter((r) => r.verdict === "fix_recon").map((r) => r.entry_id));
await run.snapshot("vendors", todo.filter((r) => r.verdict !== "fix_recon").map((r) => r.vendor_id));

const counts = { fix_recon: 0, remove_tag: 0, correct_tag: 0, skipped: 0, rejected: 0 };
const rejected = [];
const reject = (r, v, errors) => {
  counts.rejected++;
  rejected.push({ ...r, name: v.name, errors });
  auditNote(run, { op: "rejected", vendor_id: r.vendor_id, key: r.key, verdict: r.verdict, errors });
};

for (const r of todo) {
  const v = vendors.get(r.vendor_id);
  const entries = new Map(v.entries.map((e) => [e.id, e]));

  if (r.verdict === "fix_recon") {
    const ex = entries.get(r.entry_id);
    const live = APPLY ? run.row("recon_entries", r.entry_id) : ex;
    if (!live || !ex) { console.error(`  ${r.entry_id}: not in export or gone`); continue; }
    const cur = live[r.field] ?? "";
    if (!cur.includes(r.old)) { console.log(`  SKIP ${v.name} [${r.key}]: clause gone`); counts.skipped++; continue; }
    const card = { notes: live.notes ?? "", price_text: live.price_text ?? "", price_details: live.price_details ?? "" };
    const rv = reviewProseChange({
      vendorId: v.id,
      entry: { ...ex, ...card },
      card,
      change: { kind: "replace", field: r.field, old: r.old, text: r.new, evidence: correctionEvidence(v.filters, r) },
    });
    if (rv.errors.length) { reject(r, v, rv.errors); continue; }
    if (!APPLY) {
      console.log(`  fix_recon ${v.name} [${r.key}]\n    - ${r.old}\n    + ${r.new}`);
      for (const q of rv.verified) console.log(`      evidence [${q.source}]: "${q.quote}"`);
    } else {
      const { error: e2 } = await run.update(
        "recon_entries",
        r.entry_id,
        { [r.field]: rv.after[r.field], updated_at: new Date().toISOString() },
        { evidence: rv.verified, reason: `fix_recon ${r.key}: ${r.reason ?? ""}` },
      );
      if (e2) { console.error(`  ${r.entry_id}: ${e2.message}`); continue; }
    }
    counts.fix_recon++;
  } else {
    // remove_tag / correct_tag both mutate filters. The snapshot read is the
    // fresh read, so a value that moved since export is not clobbered.
    const live = APPLY ? run.row("vendors", r.vendor_id) : v;
    if (!live) { console.error(`  ${r.vendor_id}: gone since export`); continue; }
    if (live.filters_meta?.[r.key]?.source === "manual") { console.log(`  SKIP ${v.name} [${r.key}]: manual`); counts.skipped++; continue; }

    const filters = { ...(live.filters ?? {}) };
    const meta = { ...(live.filters_meta ?? {}) };
    const stamp = new Date().toISOString();
    const nextSource = live.filters_source === "manual" ? "manual" : "recon";

    if (r.verdict === "remove_tag") {
      if (filters[r.key] == null) { counts.skipped++; continue; }
      const was = filters[r.key];
      delete filters[r.key];
      delete meta[r.key];
      if (!APPLY) console.log(`  remove_tag ${v.name} [${r.key}=${JSON.stringify(was)}]  (${r.reason})`);
      else {
        const { error: e2 } = await run.update(
          "vendors", r.vendor_id,
          { filters, filters_meta: meta, filters_source: nextSource, filters_updated_at: stamp },
          { reason: `remove_tag ${r.key}: ${r.reason ?? ""}` },
        );
        if (e2) { console.error(`  ${r.vendor_id}: ${e2.message}`); continue; }
      }
      counts.remove_tag++;
    } else if (r.verdict === "correct_tag") {
      const tv = reviewTagWrite({ vendorId: v.id, write: r, entry: entries.get(r.entry_id) });
      if (tv.errors.length) { reject(r, v, tv.errors); continue; }
      const was = filters[r.key];
      filters[r.key] = r.value;
      meta[r.key] = { source: "recon", updated_at: stamp, quote: r.quote, entry_id: r.entry_id };
      if (!APPLY) console.log(`  correct_tag ${v.name} [${r.key}: ${JSON.stringify(was)} -> ${JSON.stringify(r.value)}]`);
      else {
        const { error: e2 } = await run.update(
          "vendors", r.vendor_id,
          { filters, filters_meta: meta, filters_source: nextSource, filters_updated_at: stamp },
          { evidence: [{ quote: r.quote, source: `recon_entries/${r.entry_id}` }, ...tv.verified], reason: `correct_tag ${r.key}: ${r.reason ?? ""}` },
        );
        if (e2) { console.error(`  ${r.vendor_id}: ${e2.message}`); continue; }
      }
      counts.correct_tag++;
    }
  }
  if (APPLY) appendFileSync(logPath, JSON.stringify({ k: key(r), run_id: run.runId }) + "\n");
}

writeJsonl(join(dir, `apply-fix-rejected${ONLY ? "-" + ONLY : ""}.jsonl`), rejected);
for (const r of rejected) console.log(`  REJECT ${r.name} [${r.verdict} ${r.key}]: ${r.errors.join("; ")}`);

console.log(
  [
    "",
    APPLY ? "APPLIED" : "DRY RUN - nothing written",
    `  fix_recon:   ${counts.fix_recon}`,
    `  remove_tag:  ${counts.remove_tag}`,
    `  correct_tag: ${counts.correct_tag}`,
    `  skipped:     ${counts.skipped}`,
    `  rejected:    ${counts.rejected}`,
    "",
    run.where(),
  ].join("\n"),
);
