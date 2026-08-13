#!/usr/bin/env node
/**
 * On-write reconcile, phase 3 - validate, merge, write, and report.
 *
 *   node scripts/reconcile/daily-apply.mjs --work daily-20260812           (dry run)
 *   node scripts/reconcile/daily-apply.mjs --work daily-20260812 --apply
 *
 * Reads  results.jsonl (from batch collect), vendors.jsonl, watermark.json
 * Writes vendors.filters / filters_meta (on --apply), report.md, applied.jsonl
 *
 * Dry run by default. This is the one phase that mutates the database, and every
 * write here can hide a vendor from a filtered search, so the safe mode is the
 * one you get without thinking.
 *
 * WHAT IT WRITES, per the model's op on each tag:
 *   create    - set a key that had no value
 *   extend    - union a list, or widen a range (min key down, max key up)
 *   overwrite - a RESOLVED contradiction (human over bot, then weight of
 *               evidence). Applied, but called out at the top of report.md so a
 *               wrong overturn can be reverted with restore.mjs.
 *   retract   - remove a tag whose only supporting entry is gone
 *
 * The model can also decline. An ambiguity it could not settle comes back under
 * "skipped": the tag is left exactly as it is and nothing is written. That is the
 * contract working, not failing - but it is the one signal a run produces that
 * only a person can act on, so it gets its own report section (and lands in
 * applied.jsonl as model_skips). Kept apart from "Rejected writes", which are
 * validation failures - a bad write the gate caught, not a call the model made.
 *
 * Every write must carry a quote that appears verbatim in the entry it cites;
 * fabricated evidence fails mechanically. Keys whose provenance is manual are
 * never touched (per-key, migration 0037), and a whole vendor whose row-level
 * filters_source is manual is skipped outright.
 *
 * dirty flag: a vendor that got a result is cleared (filters_dirty_at <= the
 * export watermark), so it is not reprocessed. A recon entry that landed after
 * the export keeps a newer stamp and survives to the next run. A vendor the
 * batch dropped (no result) is never cleared, so it retries.
 */

import { writeFileSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { serviceClient, workdir, readJsonl, arg, has } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: daily-apply.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const dir = workdir(WORK);

const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));
const results = existsSync(join(dir, "results.jsonl"))
  ? readJsonl(join(dir, "results.jsonl"))
  : [];
const { watermark } = JSON.parse(readFileSync(join(dir, "watermark.json"), "utf8"));

if (results.length === 0) {
  console.log("No results to apply.");
  process.exit(0);
}

// --- per-type filter definitions -------------------------------------------

const defsFor = (type) =>
  Object.fromEntries((VENDOR_FILTERS[type] ?? []).map((d) => [d.key, d]));

function rangeInfo(defs) {
  const keys = new Set();
  const dir = new Map(); // key -> 'min' | 'max' | 'set'
  for (const d of Object.values(defs)) {
    if (d.kind !== "range") continue;
    const lo = d.lo ?? d.key;
    keys.add(lo);
    if (d.hi) {
      keys.add(d.hi);
      dir.set(lo, "min");
      dir.set(d.hi, "max");
    } else {
      // Single-key range: widen from the name if we can, otherwise a plain set.
      dir.set(lo, /max/.test(lo) ? "max" : /min/.test(lo) ? "min" : "set");
    }
  }
  return { keys, dir };
}

const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

// --- build the plan (validation happens here, no DB writes yet) -------------

const plan = new Map(); // vendor_id -> { sets:[{key,value,op}], deletes:[key], changes:[…], skips:[…], errs:[] }
const processed = new Set();
// modelSkips and skippedManual are different things and must never be added up:
// a model skip is one ambiguous TAG the model declined to settle; skippedManual
// is a whole VENDOR left alone because its row-level filters_source is manual.
const stats = { create: 0, extend: 0, overwrite: 0, retract: 0, falseWrites: 0, rejected: 0, modelSkips: 0, skippedManual: 0 };

for (const r of results) {
  const v = vendors.get(r.vendor_id);
  if (!v) continue; // a result for a vendor not in this export; ignore.
  processed.add(r.vendor_id);

  const defs = defsFor(v.vendor_type);
  const { keys: ranges, dir: rangeDir } = rangeInfo(defs);
  const entries = new Map(v.entries.map((e) => [e.id, e]));
  const at = `${v.name} (${v.vendor_type})`;

  const sets = [];
  const deletes = [];
  const changes = [];
  const skips = [];
  const errs = [];

  for (const w of r.writes ?? []) {
    const where = `${at} ${w.key}`;
    const def = defs[w.key];
    const isRange = ranges.has(w.key);
    if (!def && !isRange) {
      errs.push(`${where}: not an attribute of ${v.vendor_type}`);
      continue;
    }
    // Locked: a human set this through the app. Enforce even though the model
    // was told - the gate is the guarantee, not the instruction.
    if (v.filters_meta?.[w.key]?.source === "manual") {
      errs.push(`${where}: LOCKED (manual) - refusing to change`);
      continue;
    }

    // Evidence, mechanically. The quote must exist in the cited entry.
    const src = entries.get(w.entry_id);
    if (!src) {
      errs.push(`${where}: cites entry ${w.entry_id}, not this vendor's`);
      continue;
    }
    const quote = norm(w.quote);
    if (!quote) {
      errs.push(`${where}: no quote - every write carries its evidence`);
      continue;
    }
    const haystack = norm([src.notes, src.price_text, src.price_details, src.service_region].join(" "));
    if (!haystack.includes(quote)) {
      errs.push(`${where}: quote not found in entry ${w.entry_id} - evidence invented`);
      continue;
    }

    // Value shape.
    if (def?.kind === "multi") {
      const allowed = new Set(def.options.map((o) => o.value));
      const vals = (Array.isArray(w.value) ? w.value : [w.value]).map(String);
      const bad = vals.filter((x) => !allowed.has(x));
      if (bad.length) {
        errs.push(`${where}: value(s) not allowed: ${bad.join(", ")}`);
        continue;
      }
      sets.push({ key: w.key, value: vals, op: w.op, kind: "multi" });
    } else if (def?.kind === "bool") {
      if (typeof w.value !== "boolean") {
        errs.push(`${where}: expected true or false`);
        continue;
      }
      if (w.value === false) stats.falseWrites++;
      sets.push({ key: w.key, value: w.value, op: w.op, kind: "bool", note: w.note });
    } else {
      if (typeof w.value !== "number" || !Number.isFinite(w.value)) {
        errs.push(`${where}: expected a number`);
        continue;
      }
      if (/price/.test(w.key) && !w.basis) {
        errs.push(`${where}: price with no basis - would compare on the wrong axis`);
        continue;
      }
      sets.push({ key: w.key, value: w.value, op: w.op, kind: "range", dir: rangeDir.get(w.key) ?? "set" });
    }

    const op = w.op === "extend" ? "extend" : w.op === "overwrite" ? "overwrite" : "create";
    stats[op] = (stats[op] ?? 0) + 1;
    changes.push({
      key: w.key,
      op,
      old: v.filters?.[w.key] ?? null,
      value: w.value,
      quote: w.quote,
      human: w.human_support,
      bot: w.bot_support,
      note: w.note,
    });
  }

  for (const rt of r.retract ?? []) {
    if (!(rt.key in (v.filters ?? {}))) continue; // already absent
    if (v.filters_meta?.[rt.key]?.source === "manual") {
      errs.push(`${at} ${rt.key}: LOCKED (manual) - refusing to retract`);
      continue;
    }
    deletes.push(rt.key);
    stats.retract++;
    changes.push({ key: rt.key, op: "retract", old: v.filters?.[rt.key] ?? null, reason: rt.reason });
  }

  // Abstentions. Nothing is validated and nothing is written - a skip IS the
  // absence of a write - so this only has to survive as far as the report. The
  // current value rides along because the ambiguity is always recon-vs-tag, and
  // the tag is what the reader would otherwise go and look up.
  for (const sk of r.skipped ?? []) {
    const key = sk?.key ?? "(unspecified)";
    skips.push({ key, why: sk?.why ?? "", current: v.filters?.[key] ?? null });
    stats.modelSkips++;
  }

  if (errs.length) stats.rejected += errs.length;
  plan.set(r.vendor_id, { sets, deletes, changes, skips, errs, vendor: v });
}

// --- apply (fresh read + merge) --------------------------------------------

const db = APPLY ? serviceClient() : null;
const logPath = join(dir, "applied.jsonl");
const alreadyApplied = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).vendor_id)
    : [],
);

/** Merge one plan into a fresh filters/meta pair, honoring per-key manual. */
function merge(live, p, stamp) {
  const filters = { ...(live.filters || {}) };
  const meta = { ...(live.filters_meta || {}) };
  for (const s of p.sets) {
    if (meta[s.key]?.source === "manual") continue; // per-key lock, re-checked live
    if (s.kind === "multi") {
      const existing = Array.isArray(filters[s.key]) ? filters[s.key] : [];
      filters[s.key] =
        s.op === "extend" ? [...new Set([...existing, ...s.value])] : [...new Set(s.value)];
    } else if (s.kind === "range" && s.op === "extend" && typeof filters[s.key] === "number") {
      filters[s.key] =
        s.dir === "min" ? Math.min(filters[s.key], s.value)
        : s.dir === "max" ? Math.max(filters[s.key], s.value)
        : s.value;
    } else {
      filters[s.key] = s.value;
    }
    meta[s.key] = { source: "recon", updated_at: stamp, quote: p.changes.find((c) => c.key === s.key)?.quote };
  }
  for (const key of p.deletes) {
    if (meta[key]?.source === "manual") continue;
    delete filters[key];
    delete meta[key];
  }
  return { filters, meta };
}

let wrote = 0;
let clearedDirty = 0;
for (const vid of processed) {
  const p = plan.get(vid);
  if (!p) continue;
  if (APPLY && alreadyApplied.has(vid)) {
    continue;
  }

  if (!APPLY) continue;

  // Fresh read - a value that changed since the export must not be clobbered by
  // a stale copy, and the manual guard has to see current provenance.
  const { data: live } = await db
    .from("vendors")
    .select("filters, filters_meta, filters_source, filters_dirty_at")
    .eq("id", vid)
    .single();
  if (!live) continue;

  const canClear = live.filters_dirty_at && watermark && live.filters_dirty_at <= watermark;

  if (live.filters_source === "manual") {
    // Whole-vendor manual: leave every tag alone. Still clear its dirty flag so
    // it is not reprocessed forever.
    stats.skippedManual++;
    if (canClear) {
      await db.from("vendors").update({ filters_dirty_at: null }).eq("id", vid).lte("filters_dirty_at", watermark);
      clearedDirty++;
    }
    // Log any model skips here too, even though this vendor's tags are the
    // human's either way: the report counts them, so a log that dropped them
    // would disagree with it for no reason a reader could work out.
    const manualLine = { vendor_id: vid, skipped: "manual" };
    if (p.skips.length) manualLine.model_skips = p.skips;
    appendFileSync(logPath, JSON.stringify(manualLine) + "\n");
    continue;
  }

  const stamp = new Date().toISOString();
  const hasChanges = p.sets.length > 0 || p.deletes.length > 0;

  if (hasChanges) {
    const { filters, meta } = merge(live, p, stamp);
    const patch = { filters, filters_meta: meta, filters_source: "recon", filters_updated_at: stamp };
    if (canClear) patch.filters_dirty_at = null;
    const { error } = await db.from("vendors").update(patch).eq("id", vid);
    if (error) {
      console.error(`  ${vid}: write failed - ${error.message}`);
      continue;
    }
    wrote++;
    if (canClear) clearedDirty++;
  } else if (canClear) {
    // Reconciled, nothing to change: just clear the flag.
    await db.from("vendors").update({ filters_dirty_at: null }).eq("id", vid).lte("filters_dirty_at", watermark);
    clearedDirty++;
  }

  const logLine = { vendor_id: vid, sets: p.sets.length, deletes: p.deletes.length };
  // Deliberately NOT the key "skipped": the manual branch above already writes
  // {"skipped":"manual"} as a string, and one file carrying both a string and an
  // array under one key cannot be queried across runs, which is the whole point.
  if (p.skips.length) logLine.model_skips = p.skips;
  appendFileSync(logPath, JSON.stringify(logLine) + "\n");
}

// --- report -----------------------------------------------------------------

const overwrites = [];
const retractions = [];
const falses = [];
const modelSkips = [];
const rejections = [];
for (const [, p] of plan) {
  const v = p.vendor;
  for (const c of p.changes) {
    if (c.op === "overwrite")
      overwrites.push(
        `- **${v.name}** (${v.vendor_type}) \`${c.key}\`: ${JSON.stringify(c.old)} -> ${JSON.stringify(c.value)}  ` +
          `(human ${c.human ?? "?"} vs bot ${c.bot ?? "?"})${c.note ? ` - ${c.note}` : ""}\n` +
          `  evidence: "${c.quote}"`,
      );
    if (c.op === "retract")
      retractions.push(`- **${v.name}** (${v.vendor_type}) \`${c.key}\` was ${JSON.stringify(c.old)} - ${c.reason ?? ""}`);
    if (c.value === false)
      falses.push(`- **${v.name}** (${v.vendor_type}) \`${c.key}\` set false${c.note ? ` - ${c.note}` : ""}: "${c.quote}"`);
  }
  for (const s of p.skips)
    modelSkips.push(
      `- **${v.name}** (${v.vendor_type}) \`${s.key}\` - ` +
        `${s.current === null ? "no current tag" : `tag left at ${JSON.stringify(s.current)}`}\n` +
        `  why: ${s.why || "(no reason given)"}\n` +
        `  vendor: \`${v.id}\``,
    );
  for (const e of p.errs) rejections.push(`- ${e}`);
}

const noResult = [...vendors.keys()].filter((id) => !processed.has(id));

const report = [
  `# On-write filter reconcile - ${WORK}`,
  "",
  `${new Date().toISOString()} - ${APPLY ? "APPLIED" : "DRY RUN"}`,
  "",
  `Dirty vendors exported: ${vendors.size}. Got a model result: ${processed.size}. ` +
    `No result (stay dirty, retry next run): ${noResult.length}.`,
  "",
  `Writes: create ${stats.create}, extend ${stats.extend}, overwrite ${stats.overwrite}, retract ${stats.retract}. ` +
    `Model skips (ambiguous, nothing written): ${stats.modelSkips}. ` +
    `Rejected on validation: ${stats.rejected}. Manual vendors skipped: ${stats.skippedManual}.`,
  APPLY ? `Rows written: ${wrote}. Dirty flags cleared: ${clearedDirty}.` : `(dry run - nothing written)`,
  "",
  "## Undo",
  "",
  "Revert every filter this run touched to the pre-run snapshot:",
  "",
  "```",
  `node scripts/reconcile/restore.mjs --work ${WORK} --apply`,
  "```",
  "",
  `## Contradictions overwritten (${overwrites.length}) - REVIEW THESE`,
  "",
  "A recon entry disproved an existing tag and the tag was replaced. Human recon",
  "beats bot; then weight of evidence. If one is wrong, restore (above).",
  "",
  ...(overwrites.length ? overwrites : ["_none_"]),
  "",
  `## Retractions (${retractions.length})`,
  "",
  ...(retractions.length ? retractions : ["_none_"]),
  "",
  `## Explicit false writes (${falses.length}) - each removes the vendor from that filter`,
  "",
  ...(falses.length ? falses : ["_none_"]),
  "",
  `## Model skips (${modelSkips.length}) - ambiguous, needs a human look`,
  "",
  "The recon said something about this tag that the model could not settle against",
  "the current value, so it left the tag alone rather than guess. Nothing was",
  "written. These are not errors - they are the run's open questions, and the tag",
  "sitting in the DB may well be the wrong one.",
  "",
  ...(modelSkips.length ? modelSkips : ["_none_"]),
  "",
  `## Rejected writes (${rejections.length}) - reported, not applied`,
  "",
  ...(rejections.length ? rejections.slice(0, 100) : ["_none_"]),
].join("\n");

writeFileSync(join(dir, "report.md"), report + "\n");
console.log(report);
console.log(`\nReport: ${join(dir, "report.md")}`);
if (!APPLY) console.log("\nDry run. Re-run with --apply to write.");
