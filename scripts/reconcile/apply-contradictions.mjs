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
 */

import { join } from "node:path";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { serviceClient, workdir, readJsonl, arg, has } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: apply-contradictions.mjs --work <name> [--only VERDICT] [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const ONLY = arg("only");
const db = serviceClient();
const dir = workdir(WORK);

let accepted = readJsonl(join(dir, "accepted-fix.jsonl"));
if (ONLY) accepted = accepted.filter((r) => r.verdict === ONLY);
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));

const logPath = join(dir, `applied-fix${ONLY ? "-" + ONLY : ""}.jsonl`);
const key = (r) => `${r.vendor_id}|${r.key}|${r.verdict}`;
const done = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).k)
    : [],
);

const counts = { fix_recon: 0, remove_tag: 0, correct_tag: 0, skipped: 0 };

for (const r of accepted) {
  if (done.has(key(r))) continue;
  const v = vendors.get(r.vendor_id);

  if (r.verdict === "fix_recon") {
    const { data: live, error } = await db.from("recon_entries").select(r.field).eq("id", r.entry_id).single();
    if (error) { console.error(`  ${r.entry_id}: ${error.message}`); continue; }
    const cur = live[r.field] ?? "";
    if (!cur.includes(r.old)) { console.log(`  SKIP ${v.name} [${r.key}]: clause gone`); counts.skipped++; continue; }
    if (!APPLY) console.log(`  fix_recon ${v.name} [${r.key}]\n    - ${r.old}\n    + ${r.new}`);
    else {
      const { error: e2 } = await db.from("recon_entries").update({ [r.field]: cur.replace(r.old, r.new), updated_at: new Date().toISOString() }).eq("id", r.entry_id);
      if (e2) { console.error(`  ${r.entry_id}: ${e2.message}`); continue; }
    }
    counts.fix_recon++;
  } else {
    // remove_tag / correct_tag both mutate filters. Read live so a value that
    // moved since export is not clobbered by a stale copy.
    const { data: live, error } = await db.from("vendors").select("filters,filters_meta,filters_source").eq("id", r.vendor_id).single();
    if (error) { console.error(`  ${r.vendor_id}: ${error.message}`); continue; }
    if (live.filters_meta?.[r.key]?.source === "manual") { console.log(`  SKIP ${v.name} [${r.key}]: manual`); counts.skipped++; continue; }

    const filters = { ...(live.filters ?? {}) };
    const meta = { ...(live.filters_meta ?? {}) };
    const stamp = new Date().toISOString();

    if (r.verdict === "remove_tag") {
      if (filters[r.key] == null) { counts.skipped++; continue; }
      const was = filters[r.key];
      delete filters[r.key];
      delete meta[r.key];
      if (!APPLY) console.log(`  remove_tag ${v.name} [${r.key}=${JSON.stringify(was)}]  (${r.reason})`);
      else {
        const { error: e2 } = await db.from("vendors").update({ filters, filters_meta: meta, filters_source: live.filters_source === "manual" ? "manual" : "recon", filters_updated_at: stamp }).eq("id", r.vendor_id);
        if (e2) { console.error(`  ${r.vendor_id}: ${e2.message}`); continue; }
      }
      counts.remove_tag++;
    } else if (r.verdict === "correct_tag") {
      const was = filters[r.key];
      filters[r.key] = r.value;
      meta[r.key] = { source: "recon", updated_at: stamp, quote: r.quote };
      if (!APPLY) console.log(`  correct_tag ${v.name} [${r.key}: ${JSON.stringify(was)} -> ${JSON.stringify(r.value)}]`);
      else {
        const { error: e2 } = await db.from("vendors").update({ filters, filters_meta: meta, filters_source: live.filters_source === "manual" ? "manual" : "recon", filters_updated_at: stamp }).eq("id", r.vendor_id);
        if (e2) { console.error(`  ${r.vendor_id}: ${e2.message}`); continue; }
      }
      counts.correct_tag++;
    }
  }
  if (APPLY) appendFileSync(logPath, JSON.stringify({ k: key(r) }) + "\n");
}

console.log(
  [
    "",
    APPLY ? "APPLIED" : "DRY RUN - nothing written",
    `  fix_recon:   ${counts.fix_recon}`,
    `  remove_tag:  ${counts.remove_tag}`,
    `  correct_tag: ${counts.correct_tag}`,
    `  skipped:     ${counts.skipped}`,
    APPLY ? "" : `\nRe-run with --apply. restore.mjs --work ${WORK} undoes it.`,
  ].join("\n"),
);
