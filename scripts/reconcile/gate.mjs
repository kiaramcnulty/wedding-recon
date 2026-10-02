#!/usr/bin/env node
/**
 * Phase 4 - validate model output before anything reaches the database.
 *
 *   node scripts/reconcile/gate.mjs --work co-all
 *
 * Reads  results.jsonl  (one model JSON object per vendor, from collect)
 * Writes accepted.jsonl, rejected.jsonl, gate-report.txt
 *
 * The prose regexes come from prose-gate.mjs, the one definition shared with
 * the enrich gates - each one is there because it caught a real defect that
 * reached production.
 *
 * The check that does the most work here is none of those, though: it is
 * `quote appears verbatim in the cited entry`. Every filter write must carry the
 * sentence it was read from, and that sentence must actually exist in that
 * entry. A model that infers a tag rather than reading one cannot produce a
 * quote that survives a substring test, so fabricated evidence fails
 * mechanically instead of needing a human to catch it.
 *
 * That check alone was not enough (2026-10-02 audit of the 2026-08-09/11 run):
 * the appends this pass wrote to match a tag became the "recon quote" the next
 * pass read the tag back from. So every append now also needs `evidence` - a
 * verbatim quote from a harvested source page or review - and a tag read off a
 * BOT entry needs the same, both checked by evidence.mjs (shared with apply.mjs,
 * which re-runs every check before it writes). An edit that fails takes the
 * tags it documents with it: an unconfirmable fact gets neither the sentence
 * nor the tag (Kiara, 2026-10-02).
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { workdir, readJsonl, writeJsonl, arg } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";
import { reviewProseChange, reviewTagWrite } from "./evidence.mjs";
import { MONEY } from "./prose-gate.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: gate.mjs --work <name>");
  process.exit(1);
}
const dir = workdir(WORK);

// --- gates -------------------------------------------------------------------
// The prose gates are imported from prose-gate.mjs, the single definition
// (2026-10-02). This file used to carry its own copies "in lockstep", and the
// copies drifted; matching runs on gateText() so curly apostrophes count.
const ESCAPED_NL = /\\{1,2}n/;


const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

// --- inputs -----------------------------------------------------------------

const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));
const results = readJsonl(join(dir, "results.jsonl"));

const defsFor = (type) =>
  Object.fromEntries((VENDOR_FILTERS[type] ?? []).map((d) => [d.key, d]));

/** Range attributes expose lo/hi keys (price_min/price_max), not the def key. */
function rangeKeys(defs) {
  const out = new Set();
  for (const d of Object.values(defs)) {
    if (d.kind !== "range") continue;
    out.add(d.lo ?? d.key);
    if (d.hi) out.add(d.hi);
  }
  return out;
}

const accepted = [];
const rejected = [];
const stats = {
  vendors: 0,
  edits: 0,
  writes: 0,
  contradictions: 0,
  listCreated: 0,
  listAppended: 0,
  falseWrites: [],
  repairedEscapes: 0,
  longEntries: [],
};

for (const r of results) {
  const v = vendors.get(r.vendor_id);
  const errs = [];
  if (!v) {
    rejected.push({ ...r, errors: ["unknown vendor_id"] });
    continue;
  }
  const defs = defsFor(v.vendor_type);
  const ranges = rangeKeys(defs);
  const entries = new Map(v.entries.map((e) => [e.id, e]));
  const at = `${v.name} (${v.vendor_type})`;

  // --- prose edits ---------------------------------------------------------
  const edits = [];
  const cards = new Map();
  const failedKeys = new Set();
  for (const e of r.recon_edits ?? []) {
    const target = entries.get(e.entry_id);
    const where = `${at} entry ${e.entry_id}`;
    if (!target) {
      errs.push(`${where}: entry not in this vendor's export`);
      continue;
    }
    // Hard line, same as migration 0036: a real person's words are theirs.
    if (!target.is_bot) {
      errs.push(`${where}: NOT a bot entry - refusing to edit a real person's words`);
      continue;
    }
    if (!["notes", "price_details"].includes(e.field)) {
      errs.push(`${where}: field "${e.field}" is not editable`);
      continue;
    }
    let text = String(e.append ?? "").trim();
    if (!text) {
      errs.push(`${where}: empty append`);
      continue;
    }
    // Repaired, not rejected - the same call upload.mjs makes for these.
    if (ESCAPED_NL.test(text)) {
      text = text.replace(/\\{1,2}n/g, " ").replace(/\s+/g, " ").trim();
      stats.repairedEscapes++;
    }

    // The text-only prose gates (BANNED, PROCESS/RESEARCH, EMDASH, QUOTE_ONLY next to a
    // figure, dossier markers) run inside reviewProseChange below, via guardProseEdit ->
    // checkProse. They used to ALSO run here, so one "stunning" was reported twice.

    const after = (target.length ?? 0) + text.length;
    if (after > 1200) stats.longEntries.push(`${where}: ${target.length} -> ${after} chars`);

    const field = MONEY.test(text) && e.field === "notes" ? "price_details" : e.field;
    const card = cards.get(e.entry_id) ?? { notes: target.notes ?? "", price_text: target.price_text ?? "", price_details: target.price_details ?? "" };
    const rv = reviewProseChange({ vendorId: v.id, entry: target, card, change: { kind: "append", field, text, evidence: e.evidence } });
    if (rv.errors.length) {
      errs.push(...rv.errors.map((x) => `${where}: ${x}`));
      for (const k of e.documents ?? []) failedKeys.add(k);
      continue;
    }
    cards.set(e.entry_id, rv.after);
    edits.push({ ...e, append: text });
  }

  // --- filter writes -------------------------------------------------------
  const writes = [];
  for (const w of r.filter_writes ?? []) {
    const where = `${at} ${w.key}`;
    const def = defs[w.key];
    const isRange = ranges.has(w.key);
    if (!def && !isRange) {
      errs.push(`${where}: not an attribute of vendor type ${v.vendor_type}`);
      continue;
    }

    // Evidence, mechanically. The quote must exist in the entry it cites.
    const src = entries.get(w.entry_id);
    if (!src) {
      errs.push(`${where}: cites entry ${w.entry_id}, which is not this vendor's`);
      continue;
    }
    const quote = norm(w.quote);
    if (!quote) {
      errs.push(`${where}: no quote - every tag write must carry its evidence`);
      continue;
    }
    const haystack = norm(
      [src.notes, src.price_text, src.price_details, src.service_region].join(" "),
    );
    if (!haystack.includes(quote)) {
      errs.push(`${where}: quote not found in entry ${w.entry_id} - evidence is invented`);
      continue;
    }
    if (failedKeys.has(w.key)) {
      errs.push(`${where}: its documenting edit was rejected - an unconfirmable fact gets neither the sentence nor the tag`);
      continue;
    }
    const tv = reviewTagWrite({ vendorId: v.id, write: w, entry: src });
    if (tv.errors.length) {
      errs.push(...tv.errors.map((x) => `${where}: ${x}`));
      continue;
    }

    // Value shape.
    if (def?.kind === "multi") {
      const allowed = new Set(def.options.map((o) => o.value));
      const vals = Array.isArray(w.value) ? w.value : [w.value];
      const bad = vals.filter((x) => !allowed.has(String(x)));
      if (bad.length) {
        errs.push(`${where}: value(s) not in the allowed list: ${bad.join(", ")}`);
        continue;
      }
      // A non-empty list is read as complete: anything not in it EXCLUDES the
      // vendor from a search for that value. Growing an existing list can only
      // add matches; creating one from nothing is the move that can hide a
      // vendor, so it is counted separately for the human read.
      const existing = v.filters[w.key];
      if (Array.isArray(existing) && existing.length) stats.listAppended++;
      else stats.listCreated++;
    } else if (def?.kind === "bool") {
      if (typeof w.value !== "boolean") {
        errs.push(`${where}: expected true or false`);
        continue;
      }
      // Never auto-trusted. An explicit false removes the vendor from that
      // filter entirely, so every one is named for a human to read.
      if (w.value === false) stats.falseWrites.push(`${where}: "${w.quote}"`);
    } else {
      if (typeof w.value !== "number" || !Number.isFinite(w.value)) {
        errs.push(`${where}: expected a number`);
        continue;
      }
      if (/price/.test(w.key) && !w.basis) {
        errs.push(`${where}: price with no basis - it would be compared on the wrong axis`);
        continue;
      }
    }
    writes.push(w);
  }

  stats.vendors++;
  stats.edits += edits.length;
  stats.writes += writes.length;
  stats.contradictions += (r.contradictions ?? []).length;

  if (errs.length) rejected.push({ vendor_id: r.vendor_id, name: v.name, errors: errs });
  if (edits.length || writes.length)
    accepted.push({ vendor_id: r.vendor_id, recon_edits: edits, filter_writes: writes });
}

writeJsonl(join(dir, "accepted.jsonl"), accepted);
writeJsonl(join(dir, "rejected.jsonl"), rejected);

const contradictions = results.flatMap((r) =>
  (r.contradictions ?? []).map(
    (c) => `  ${vendors.get(r.vendor_id)?.name}: ${c.key} tagged ${JSON.stringify(c.tag)} but recon says "${c.recon}"`,
  ),
);

const report = [
  `Reconciliation gate - ${WORK}`,
  new Date().toISOString(),
  "",
  `vendors with output:      ${stats.vendors}`,
  `prose edits accepted:     ${stats.edits}`,
  `filter writes accepted:   ${stats.writes}`,
  `vendors with rejections:  ${rejected.length}`,
  `escaped newlines repaired:${String(stats.repairedEscapes).padStart(4)}`,
  "",
  "LIST WRITES - read these before applying",
  `  appended to an existing list (safe, only adds matches): ${stats.listAppended}`,
  `  created a list from nothing (asserts completeness):     ${stats.listCreated}`,
  "",
  `EXPLICIT false WRITES (${stats.falseWrites.length}) - each one removes the vendor from that filter:`,
  ...(stats.falseWrites.length ? stats.falseWrites : ["  none"]),
  "",
  `CONTRADICTIONS (${contradictions.length}) - tag disagrees with recon, nothing written:`,
  ...(contradictions.length ? contradictions.slice(0, 40) : ["  none"]),
  "",
  `ENTRIES OVER 1200 CHARS AFTER APPEND (${stats.longEntries.length}) - reported, never trimmed:`,
  ...(stats.longEntries.length ? stats.longEntries.slice(0, 30) : ["  none"]),
  "",
  `REJECTIONS (${rejected.length}):`,
  ...rejected.slice(0, 50).flatMap((r) => [`  ${r.name}`, ...r.errors.map((e) => `    ${e}`)]),
].join("\n");

writeFileSync(join(dir, "gate-report.txt"), report + "\n");
console.log(report);
