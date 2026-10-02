#!/usr/bin/env node
/**
 * On-write reconcile - apply the WEBSITE MINING half of the batch result.
 *
 *   node scripts/reconcile/daily-mine-apply.mjs --work <name>            (dry run)
 *   node scripts/reconcile/daily-mine-apply.mjs --work <name> --apply
 *
 * daily-apply.mjs handles the tag-RECONCILE half (writes/retract/skipped from a
 * vendor existing recon). This handles the MINING half: the model read a vendor
 * OWN website and drafted a recon entry plus the tags it supports (the `site`
 * field). We INSERT that entry under a CO roster bot and write its tags. It is a
 * separate script from the tag-only reconcile on purpose - this is the ONE place
 * the daily pass AUTHORS recon, so every recon-writing guard lives here and the
 * working reconcile is left untouched.
 *
 * Guards (Kiara asked for the same key gates as enrichvendors, 2026-08-17):
 *   - prose gate (prose-gate.mjs): banned phrases, process-tells, research
 *     narration, em dashes, quote-only-with-a-figure -> a violation DROPS the
 *     entry, never fails the run (unattended, so drop beats hard-fail).
 *   - every mined tag quote must be a VERBATIM substring of the drafted entry and
 *     a number must appear in its own quote -> invented evidence is dropped.
 *   - (2026-10-02, plan item 1) AND every mined tag carries a `source_quote`
 *     that is verbatim in the site text this run actually fetched (persisted by
 *     daily-build-calls to <work>/sources/) or in the vendor's harvested
 *     research. The check above only compared the model's tag quote with the
 *     model's own entry - its output graded against itself, which is how a
 *     sentence written to fit a tag passes. Every number the entry states must
 *     appear in a verified source quote, the card may not state a figure while
 *     saying no price is posted, and brand/chain wording may not set a tag.
 *     Any unverifiable tag drops the WHOLE entry: the entry is the prose that
 *     documents those tags, and an unconfirmable fact gets neither the sentence
 *     nor the tag (Kiara, 2026-10-02).
 *   - the insert and the tag write go through audit.mjs: the vendor row is
 *     snapshotted into the MAIN checkout first, and the insert is logged
 *     before and after, so restore.mjs --run <id> deletes it.
 *   - the entry author is a roster bot NOT already authoring for that vendor, so
 *     the one-entry-per-(vendor,author) index (0028) can never collide with an
 *     existing enrich or prior-run entry; a stale pick is caught at insert (23505).
 *   - mining only CREATES an absent tag; it never overwrites, and never touches a
 *     manual (LOCKED) key. If a vendor already has every mined tag, no entry is
 *     inserted - this is what makes the pass converge instead of re-authoring.
 *
 * Dry run by default. --apply inserts. mine-applied.jsonl records every insert
 * (vendor, entry_id, bot, tags) so restore.mjs can delete them; mine-report.md is
 * the human-readable record the workflow turns into a notification.
 */

import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { serviceClient, workdir, readJsonl, arg, has, ROOT } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";
import { checkProse, repairBreaks } from "./prose-gate.mjs";
import { WriteRun } from "./audit.mjs";
import { verifyEvidence, numbersIn, priceContradiction, brandLevel, runSources } from "./evidence.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: daily-mine-apply.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const dir = workdir(WORK);

const results = existsSync(join(dir, "results.jsonl")) ? readJsonl(join(dir, "results.jsonl")) : [];
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));
const sites = results.filter((r) => r.site && r.site.entry);
if (sites.length === 0) {
  console.log("No site-mined entries in the result. Nothing to do.");
  process.exit(0);
}

// Roster: CO only for now (the soft-launch market), region-scoped exactly as
// enrich does. A vendor whose region has no roster is skipped, not guessed.
const rosterPath = join(ROOT, "data/enrichvenues/rosters/CO.json");
const roster = existsSync(rosterPath)
  ? JSON.parse(readFileSync(rosterPath, "utf8")).filter((b) => b.user_id)
  : [];
const isCO = (v) => /^co$/i.test((v.region || "").trim()) || /colorado/i.test(v.region || "");

/** A roster bot for this vendor that is NOT already one of its authors. */
function pickBot(vendorId, taken) {
  if (!roster.length) return null;
  let h = 0;
  for (const ch of vendorId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < roster.length; i++) {
    const bot = roster[(h + i) % roster.length];
    if (!taken.has(bot.user_id)) return bot;
  }
  return null; // every roster bot already authors for this vendor (very unlikely)
}

/** Backdate created_at to a plausible moment inside the collected month. */
function backdate(month, year) {
  const start = Date.UTC(year, month - 1, 1);
  const hi = Math.min(Date.UTC(year, month, 1), Date.now());
  return new Date(start + Math.random() * (hi - start)).toISOString();
}

const NORM = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Gate the mined tags against the vocabulary and their own drafted prose. */
function gateTags(v, entryProse, tags, extra) {
  const defs = Object.fromEntries((VENDOR_FILTERS[v.vendor_type] ?? []).map((d) => [d.key, d]));
  const rangeKeys = new Set();
  for (const d of Object.values(defs))
    if (d.kind === "range") {
      rangeKeys.add(d.lo ?? d.key);
      if (d.hi) rangeKeys.add(d.hi);
    }
  const prose = NORM(entryProse);
  const out = {};
  const errs = [];
  for (const t of tags ?? []) {
    const def = defs[t.key];
    const isRange = rangeKeys.has(t.key);
    if (!def && !isRange) {
      errs.push(`[${t.key}] not an attribute of ${v.vendor_type}`);
      continue;
    }
    let value = t.value;
    if (def?.kind === "multi") {
      const allowed = new Set(def.options.map((o) => o.value));
      const vals = (Array.isArray(value) ? value : [value]).map(String);
      if (!vals.length || vals.some((x) => !allowed.has(x))) {
        errs.push(`[${t.key}] value(s) not allowed`);
        continue;
      }
      value = vals;
    } else if (def?.kind === "bool") {
      if (typeof value !== "boolean") {
        errs.push(`[${t.key}] expected true/false`);
        continue;
      }
    } else {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errs.push(`[${t.key}] expected a number`);
        continue;
      }
      if (/price/.test(t.key) && !t.basis) {
        errs.push(`[${t.key}] price with no basis`);
        continue;
      }
    }
    if (!t.quote) {
      errs.push(`[${t.key}] no quote`);
      continue;
    }
    if (!prose.includes(NORM(t.quote))) {
      errs.push(`[${t.key}] quote not verbatim in the drafted entry`);
      continue;
    }
    if (typeof value === "number") {
      const nums = (NORM(t.quote).match(/\d[\d,.]*/g) || []).map((s) => s.replace(/,/g, ""));
      if (!nums.includes(String(value))) {
        errs.push(`[${t.key}]=${value} not stated in its own quote`);
        continue;
      }
    }
    const brand = brandLevel(t.source_quote) || brandLevel(t.quote);
    if (brand) {
      errs.push(`[${t.key}] brand/chain-level wording ("${brand}") may not set a property tag`);
      continue;
    }
    const ev = verifyEvidence(v.id, t.source_quote ? [{ quote: t.source_quote, source: t.source }] : [], {
      numbers: typeof value === "number" ? [String(value)] : [],
      extra,
      claimText: t.quote,
    });
    if (!ev.ok) {
      errs.push(`[${t.key}] not confirmed by the fetched site: ${ev.errors.join("; ")}`);
      continue;
    }
    out[t.key] = { value, quote: t.quote, evidence: ev.verified };
  }
  return { out, errs };
}

// --- apply ------------------------------------------------------------------

const db = APPLY ? serviceClient() : null;
const run = new WriteRun({ work: WORK, script: "daily-mine-apply", apply: APPLY, db });
// Snapshot every vendor that may gain tags BEFORE anything is written; the
// snapshot read is also the live read the writable check below uses.
await run.snapshot("vendors", sites.map((r) => r.vendor_id).filter((id) => vendors.has(id)));
let created = 0;
let skipped = 0;
let tagsWritten = 0;
const lines = []; // report rows

for (const r of sites) {
  const v = vendors.get(r.vendor_id);
  if (!v) {
    skipped++;
    continue;
  }
  const at = `${v.name} (${v.vendor_type})`;
  if (!isCO(v)) {
    skipped++;
    lines.push(`- SKIP ${at}: no roster for region "${v.region}"`);
    continue;
  }

  const e = r.site.entry;
  const notes = repairBreaks(e.notes);
  const price_text = repairBreaks(e.price_text);
  const price_details = repairBreaks(e.price_details);
  const proseErrs = checkProse({ notes, price_text, price_details });
  if (proseErrs.length) {
    skipped++;
    lines.push(`- SKIP ${at}: prose gate - ${proseErrs.join("; ")}`);
    continue;
  }

  const contradiction = priceContradiction({ notes, price_text, price_details });
  if (contradiction) {
    skipped++;
    lines.push(`- SKIP ${at}: ${contradiction}`);
    continue;
  }

  const entryProse = [notes, price_text, price_details].join(" ");
  const extra = runSources(dir, v.id);
  const { out, errs } = gateTags(v, entryProse, r.site.tags, extra);
  if (Object.keys(out).length === 0) {
    skipped++;
    lines.push(`- SKIP ${at}: no valid mined tags${errs.length ? ` (${errs.join("; ")})` : ""}`);
    continue;
  }
  // The entry documents its tags; one it cannot confirm takes the entry down
  // with it, since the sentence stating that fact is in there.
  if (errs.length) {
    skipped++;
    lines.push(`- SKIP ${at}: ${errs.length} mined tag(s) failed, so the entry documenting them is dropped (${errs.join("; ")})`);
    continue;
  }
  // Every number the entry states must come from a verified site quote.
  const have = new Set(Object.values(out).flatMap((t) => t.evidence.flatMap((e) => numbersIn(e.quote))));
  const unsourced = [...new Set(numbersIn(entryProse))].filter((n) => !have.has(n));
  if (unsourced.length) {
    skipped++;
    lines.push(`- SKIP ${at}: entry states number(s) ${unsourced.join(", ")} that no verified site quote contains`);
    continue;
  }

  // Base filters for the writable check + merge: live in apply (so a tag the
  // reconcile pass just wrote is seen), the export snapshot in dry run.
  let baseFilters = v.filters || {};
  let baseMeta = v.filters_meta || {};
  let baseSource = v.filters_source;
  if (APPLY) {
    const live = run.row("vendors", v.id);
    if (!live) {
      skipped++;
      lines.push(`- SKIP ${at}: vendor gone since export`);
      continue;
    }
    baseFilters = live.filters || {};
    baseMeta = live.filters_meta || {};
    baseSource = live.filters_source;
  }

  // Mining CREATES absent tags only, never a manual (LOCKED) key. If none are
  // writable, do not author an entry - this is the convergence guard.
  const writable = Object.entries(out).filter(
    ([k]) => (baseFilters[k] === undefined || baseFilters[k] === null) && baseMeta[k]?.source !== "manual",
  );
  if (writable.length === 0) {
    skipped++;
    lines.push(`- SKIP ${at}: every mined tag already present or locked`);
    continue;
  }

  const taken = new Set((v.entries || []).map((x) => x.author_id));
  const bot = pickBot(v.id, taken);
  if (!bot) {
    skipped++;
    lines.push(`- SKIP ${at}: no free roster bot`);
    continue;
  }

  const tagList = writable.map(([k, { value }]) => `${k}=${JSON.stringify(value)}`).join(", ");
  lines.push(
    `- ${APPLY ? "ADDED" : "WOULD ADD"} ${at} by ${bot.username}: ${tagList}\n` +
      `    notes: ${notes}\n    price_text: ${price_text}` +
      (errs.length ? `\n    (dropped: ${errs.join("; ")})` : ""),
  );

  if (!APPLY) {
    created++;
    tagsWritten += writable.length;
    continue;
  }

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const tagEvidence = writable.flatMap(([k, t]) => t.evidence.map((e) => ({ key: k, ...e })));
  const { data: ins, error: insErr } = await run.insert(
    "recon_entries",
    {
      vendor_id: v.id,
      author_id: bot.user_id,
      recon_type: "virtual",
      price_text,
      price_details,
      notes,
      service_region: null,
      recon_collected_month: month,
      recon_collected_year: year,
      status: "active",
      created_at: backdate(month, year),
    },
    { evidence: tagEvidence, reason: `own-site mining: ${writable.map(([k]) => k).join(", ")}` },
  );
  if (insErr) {
    skipped++;
    lines[lines.length - 1] =
      `- SKIP ${at}: insert failed (${insErr.code === "23505" ? "author already has an entry" : insErr.message})`;
    continue;
  }
  const entryId = ins.id;

  const filters = { ...baseFilters };
  const meta = { ...baseMeta };
  const tstamp = new Date().toISOString();
  let wrote = 0;
  for (const [key, { value, quote }] of writable) {
    filters[key] = value;
    meta[key] = { source: "recon", updated_at: tstamp, quote, entry_id: entryId };
    wrote++;
  }
  const { error: upErr } = await run.update(
    "vendors",
    v.id,
    {
      filters,
      filters_meta: meta,
      filters_source: baseSource === "manual" ? "manual" : "recon",
      filters_updated_at: tstamp,
    },
    { evidence: tagEvidence, reason: `own-site mining for entry ${entryId}` },
  );
  if (upErr) console.error(`  ${at}: tag write failed - ${upErr.message} (entry ${entryId} still inserted)`);

  created++;
  tagsWritten += wrote;
  appendFileSync(
    join(dir, "mine-applied.jsonl"),
    JSON.stringify({
      vendor_id: v.id,
      vendor: v.name,
      entry_id: entryId,
      bot: bot.username,
      author_id: bot.user_id,
      tags: writable.map(([k]) => k),
      run_id: run.runId,
    }) + "\n",
  );
}

// --- report -----------------------------------------------------------------

const report = [
  `# Website mining - ${WORK}`,
  "",
  `${new Date().toISOString()} - ${APPLY ? "APPLIED" : "DRY RUN"}`,
  "",
  `Site-mined vendors in result: ${sites.length}. ` +
    `Entries ${APPLY ? "added" : "that would be added"}: ${created}. ` +
    `Tags written: ${tagsWritten}. Skipped: ${skipped}.`,
  "",
  "## Undo",
  "",
  "Delete every recon entry this run inserted and revert the tags:",
  "```",
  APPLY ? `node scripts/reconcile/restore.mjs --work ${WORK} --run ${run.runId} --apply` : "(dry run - nothing to undo)",
  "```",
  "",
  "## Entries",
  "",
  ...(lines.length ? lines : ["_none_"]),
].join("\n");

writeFileSync(join(dir, "mine-report.md"), report + "\n");
console.log(report);
if (!APPLY) console.log("\nDry run. Re-run with --apply to insert.");
