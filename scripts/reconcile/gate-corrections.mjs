#!/usr/bin/env node
/**
 * Gate the corrections before any prose is replaced.
 *
 *   node scripts/reconcile/gate-corrections.mjs --work co-all
 *
 * Reads  results-fix.jsonl
 * Writes accepted-fix.jsonl, corrections-report.txt
 *
 * The load-bearing check: `old` must appear VERBATIM in the entry field it
 * cites. A replace whose target string is not actually present would either do
 * nothing or, if forced, corrupt the entry - so a fabricated or paraphrased
 * `old` fails here rather than at apply. And `new` must state the fact: a price
 * correction has to contain a money figure, a capacity correction the number.
 *
 * Prose regexes mirror upload.mjs and gate.mjs. KEEP IN LOCKSTEP.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { workdir, readJsonl, writeJsonl, arg } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: gate-corrections.mjs --work <name>");
  process.exit(1);
}
const dir = workdir(WORK);

const BANNED =
  /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;
const PROCESS =
  /\b(crawl\w*|scrape\w*|fetch\w*|dossier|harvest\w*|parse\w*|garbled text|boilerplate|batch\w*|enrich\w*|seeded|roster|pipeline|dataset|databases?|bots?|launchintel|digest\w*)\b/i;
const RESEARCH = new RegExp(
  [
    /\b404\b|\b403\w*/,
    /\bunreachable\b|\bautomated (check|lookup|request|tool)s?\b/,
    /\b(reviews (go|going) back to|no pricing to pull|nothing to pull)\b/,
    /(?:(?:did|would|could|does|do|will|can)\s*(?:n'?t|not)|failed to|never)\s+load\b(?!\s*-?\s*in\b)/,
    /\bsite (is|was)?\s*(down|unavailable|unreadable|inaccessible)\b/,
    /\b(couldn'?t|could not|can'?t|cannot) (access|reach|open|read) (the |their )?(site|page|website)\b/,
    /\bsite is (a )?dead link\b|\bper (their|the) (site|listing) copy\b/,
  ]
    .map((r) => r.source)
    .join("|"),
  "i",
);
const EMDASH = /[—–]/;
const MONEY = /\$\s*\d|\d\s*\$|\d\s*(?:dollars|usd)\b/i;

// The export snapshot of the entries, so `old` is checked against the text the
// model was actually shown.
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));
const entryText = new Map();
for (const v of vendors.values())
  for (const e of v.entries)
    entryText.set(e.id, {
      is_bot: e.is_bot,
      notes: e.notes ?? "",
      price_text: e.price_text ?? "",
      price_details: e.price_details ?? "",
    });

const results = readJsonl(join(dir, "results-fix.jsonl"));

const accepted = [];
const rejected = [];
const declined = [];

for (const r of results) {
  if (r.action === "decline") {
    declined.push(r);
    continue;
  }
  const at = `${r.vendor_id} / ${r.entry_id} .${r.field}`;
  const errs = [];
  const e = entryText.get(r.entry_id);

  if (!e) errs.push(`${at}: entry not in this work's export`);
  else if (!e.is_bot) errs.push(`${at}: not a bot entry`);
  else if (!["notes", "price_text", "price_details"].includes(r.field))
    errs.push(`${at}: field not editable`);
  else if (!r.old || !e[r.field].includes(r.old))
    errs.push(`${at}: "old" is not a verbatim substring of the field - cannot locate the clause to replace`);
  else if (e[r.field].indexOf(r.old) !== e[r.field].lastIndexOf(r.old))
    errs.push(`${at}: "old" occurs more than once - ambiguous target`);

  const nw = String(r.new ?? "").trim();
  if (!nw) errs.push(`${at}: empty replacement`);
  else {
    const bad = nw.match(BANNED) || nw.match(PROCESS) || nw.match(RESEARCH);
    if (bad) errs.push(`${at}: replacement contains a gated phrase "${bad[0]}"`);
    if (EMDASH.test(nw)) errs.push(`${at}: em/en dash in replacement`);
    if (/\\{1,2}n/.test(nw)) errs.push(`${at}: literal escaped newline in replacement`);
  }

  // The correction must actually state the fact it exists to state.
  const key = r.field.includes("price") || /price|\$/.test(r.old ?? "") ? "price" : "value";
  if (!errs.length) {
    if (key === "price" && !MONEY.test(nw))
      errs.push(`${at}: a price correction that states no figure`);
  }

  if (errs.length) rejected.push({ ...r, errors: errs });
  else accepted.push(r);
}

writeJsonl(join(dir, "accepted-fix.jsonl"), accepted);

const report = [
  `Corrections gate - ${WORK}`,
  new Date().toISOString(),
  "",
  `corrections accepted: ${accepted.length}`,
  `model declined:       ${declined.length}`,
  `rejected by gate:     ${rejected.length}`,
  "",
  "ACCEPTED (read every one - this replaces live prose):",
  ...accepted.flatMap((r) => {
    const name = vendors.get(r.vendor_id)?.name ?? r.vendor_id;
    return [`  ${name}  [${r.fact}]`, `    - ${r.old}`, `    + ${r.new}`];
  }),
  "",
  "DECLINED by the model:",
  ...declined.map((r) => `  ${vendors.get(r.vendor_id)?.name ?? r.vendor_id}: ${r.reason}`),
  "",
  "REJECTED by the gate:",
  ...rejected.flatMap((r) => [`  ${vendors.get(r.vendor_id)?.name ?? r.vendor_id}`, ...r.errors.map((x) => `    ${x}`)]),
].join("\n");

writeFileSync(join(dir, "corrections-report.txt"), report + "\n");
console.log(report);
