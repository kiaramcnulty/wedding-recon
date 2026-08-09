#!/usr/bin/env node
/**
 * Gate the contradiction verdicts before any tag is removed or prose replaced.
 *
 *   node scripts/reconcile/gate-contradictions.mjs --work co-adj
 *
 * Reads  results-fix.jsonl   (verdicts from build-contradictions)
 * Writes accepted-fix.jsonl, contradictions-report.txt
 *
 * Per verdict:
 *   fix_recon    old must be a verbatim substring of the cited entry; new must
 *                pass the prose gates. (Same check as the corrections gate.)
 *   correct_tag  value must be valid for the attribute; quote must appear
 *                verbatim in the entry. (Same evidence rule as Direction B.)
 *   remove_tag   the key must actually be present in the vendor's filters.
 *   decline      passes through to the report only.
 *
 * remove_tag and correct_tag are grouped in the report so a human reads every
 * destructive change before apply. Prose regexes mirror upload.mjs. LOCKSTEP.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { workdir, readJsonl, writeJsonl, arg } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: gate-contradictions.mjs --work <name>");
  process.exit(1);
}
const dir = workdir(WORK);

const BANNED =
  /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;
const PROCESS =
  /\b(crawl\w*|scrape\w*|fetch\w*|dossier|harvest\w*|parse\w*|garbled text|boilerplate|batch\w*|enrich\w*|seeded|roster|pipeline|dataset|databases?|bots?|launchintel|digest\w*)\b/i;
const RESEARCH = new RegExp(
  [
    /\b404\b|\b403\w*/, /\bunreachable\b|\bautomated (check|lookup|request|tool)s?\b/,
    /\b(reviews (go|going) back to|no pricing to pull|nothing to pull)\b/,
    /(?:(?:did|would|could|does|do|will|can)\s*(?:n'?t|not)|failed to|never)\s+load\b(?!\s*-?\s*in\b)/,
    /\bsite (is|was)?\s*(down|unavailable|unreadable|inaccessible)\b/,
    /\b(couldn'?t|could not|can'?t|cannot) (access|reach|open|read) (the |their )?(site|page|website)\b/,
    /\bsite is (a )?dead link\b|\bper (their|the) (site|listing) copy\b/,
  ].map((r) => r.source).join("|"), "i",
);
const EMDASH = /[—–]/;
const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));
const defsFor = (t) => Object.fromEntries((VENDOR_FILTERS[t] ?? []).map((d) => [d.key, d]));
const rangeKeys = (defs) => {
  const s = new Set();
  for (const d of Object.values(defs)) if (d.kind === "range") { s.add(d.lo ?? d.key); if (d.hi) s.add(d.hi); }
  return s;
};

const results = readJsonl(join(dir, "results-fix.jsonl"));
const accepted = [];
const rejected = [];
const declined = [];

for (const r of results) {
  const v = vendors.get(r.vendor_id);
  const at = `${v?.name ?? r.vendor_id} ${r.key}`;
  const errs = [];
  if (!v) { rejected.push({ ...r, errors: ["unknown vendor"] }); continue; }
  if (r.verdict === "decline") { declined.push(r); continue; }

  const defs = defsFor(v.vendor_type);
  const ranges = rangeKeys(defs);
  const entries = new Map(v.entries.map((e) => [e.id, e]));

  if (r.verdict === "fix_recon") {
    const e = entries.get(r.entry_id);
    if (!e) errs.push(`${at}: entry not in export`);
    else if (!e.is_bot) errs.push(`${at}: not a bot entry`);
    else if (!["notes", "price_text", "price_details"].includes(r.field)) errs.push(`${at}: field not editable`);
    else if (!r.old || !e[r.field]?.includes(r.old)) errs.push(`${at}: "old" not a verbatim substring`);
    else if (e[r.field].indexOf(r.old) !== e[r.field].lastIndexOf(r.old)) errs.push(`${at}: "old" not unique`);
    const nw = String(r.new ?? "").trim();
    if (!nw) errs.push(`${at}: empty replacement`);
    else {
      const bad = nw.match(BANNED) || nw.match(PROCESS) || nw.match(RESEARCH);
      if (bad) errs.push(`${at}: gated phrase "${bad[0]}"`);
      if (EMDASH.test(nw)) errs.push(`${at}: em/en dash`);
      if (/\\{1,2}n/.test(nw)) errs.push(`${at}: escaped newline`);
    }
  } else if (r.verdict === "correct_tag") {
    const def = defs[r.key];
    if (!def && !ranges.has(r.key)) errs.push(`${at}: not an attribute of ${v.vendor_type}`);
    const e = entries.get(r.entry_id);
    const q = norm(r.quote);
    if (!q) errs.push(`${at}: no quote`);
    else if (!e) errs.push(`${at}: cites entry not in export`);
    else if (!norm([e.notes, e.price_text, e.price_details].join(" ")).includes(q))
      errs.push(`${at}: quote not found in entry - evidence invented`);
    if (def?.kind === "multi") {
      const allowed = new Set(def.options.map((o) => o.value));
      const vals = Array.isArray(r.value) ? r.value : [r.value];
      if (vals.some((x) => !allowed.has(String(x)))) errs.push(`${at}: value not allowed`);
    } else if (def?.kind === "bool") {
      if (typeof r.value !== "boolean") errs.push(`${at}: expected boolean`);
    } else if (typeof r.value !== "number" || !Number.isFinite(r.value)) {
      errs.push(`${at}: expected a number`);
    }
  } else if (r.verdict === "remove_tag") {
    const present = v.filters[r.key] != null && !(Array.isArray(v.filters[r.key]) && !v.filters[r.key].length);
    if (!present) errs.push(`${at}: key not present in filters - nothing to remove`);
  } else {
    errs.push(`${at}: unknown verdict "${r.verdict}"`);
  }

  if (errs.length) rejected.push({ ...r, errors: errs });
  else accepted.push(r);
}

writeJsonl(join(dir, "accepted-fix.jsonl"), accepted);

const byVerdict = (vv) => accepted.filter((r) => r.verdict === vv);
const line = (r) => `  ${vendors.get(r.vendor_id)?.name ?? r.vendor_id} [${r.key}] - ${r.reason ?? ""}`;

const report = [
  `Contradiction adjudication gate - ${WORK}`,
  new Date().toISOString(),
  "",
  `accepted:  ${accepted.length}   (fix_recon ${byVerdict("fix_recon").length}, remove_tag ${byVerdict("remove_tag").length}, correct_tag ${byVerdict("correct_tag").length})`,
  `declined by model: ${declined.length}`,
  `rejected by gate:  ${rejected.length}`,
  "",
  "REMOVE_TAG - destructive, deletes a filter value. Read every one:",
  ...byVerdict("remove_tag").map((r) => `  ${vendors.get(r.vendor_id)?.name} [${r.key}=${JSON.stringify(vendors.get(r.vendor_id)?.filters[r.key])}] - ${r.reason}`),
  "",
  "CORRECT_TAG - replaces a tag value from recon evidence:",
  ...byVerdict("correct_tag").map((r) => `  ${vendors.get(r.vendor_id)?.name} [${r.key}: ${JSON.stringify(vendors.get(r.vendor_id)?.filters[r.key])} -> ${JSON.stringify(r.value)}]  "${r.quote}"`),
  "",
  "FIX_RECON - replaces a false clause:",
  ...byVerdict("fix_recon").flatMap((r) => [`  ${vendors.get(r.vendor_id)?.name} [${r.key}]`, `    - ${r.old}`, `    + ${r.new}`]),
  "",
  `REJECTED (${rejected.length}):`,
  ...rejected.flatMap((r) => [`  ${vendors.get(r.vendor_id)?.name ?? r.vendor_id}`, ...r.errors.map((e) => `    ${e}`)]),
].join("\n");

writeFileSync(join(dir, "contradictions-report.txt"), report + "\n");
console.log(report.split("\n").slice(0, 60).join("\n"));
console.log(`\n(full report in ${join(dir, "contradictions-report.txt")})`);
