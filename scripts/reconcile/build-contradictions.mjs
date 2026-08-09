#!/usr/bin/env node
/**
 * Adjudicate the contradictions a reconciliation run surfaced (Kiara,
 * 2026-08-09): a recon entry and its own tags disagree. Decide, per case, which
 * side is right and fix the wrong one.
 *
 *   node scripts/reconcile/build-contradictions.mjs --work co-full
 *
 * Reads  <work>/results.jsonl   (the contradictions from the A/B run)
 * Writes <work>/calls-fix/*.json
 *
 * This is NOT the earlier corrections pass, which assumed the tag was right and
 * only ever edited the recon. The full run showed the opposite is common: the
 * extraction pulls a number that is not a wedding rate at all - an add-on
 * ("karaoke rental from $999"), an a la carte item ("mahi $15"), a deposit, a
 * different service's price ("$850 for videography"). There the TAG is wrong and
 * the recon is right. So the model returns a verdict, not an edit:
 *
 *   fix_recon    the tag is a solid published fact and the recon is stale or
 *                wrong - replace the false clause with the true fact.
 *   remove_tag   the tag is a misextraction the recon exposes - null it, so it
 *                stops feeding the Explore price sort with a fiction.
 *   correct_tag  the recon states the real value - replace the tag with it,
 *                carrying the recon sentence as evidence.
 *   decline      both are defensible, or it cannot tell - leave a report.
 *
 * Every verdict is gated and hand-read before it touches production. remove_tag
 * and correct_tag are destructive to filters; fix_recon replaces live prose.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { workdir, readJsonl, arg } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: build-contradictions.mjs --work <name> [--per-call 12]");
  process.exit(1);
}
const PER_CALL = Number(arg("per-call", 12));
const MODEL = arg("model", "claude-sonnet-5");
const MAX_TOKENS = Number(arg("max-tokens", 48000));

const dir = workdir(WORK);
const results = readJsonl(join(dir, "results.jsonl"));
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));

// Every filter key that carries the disputed value plus its evidence, so the
// model sees exactly what the tag is standing on. Price and capacity keep their
// verbatim quote and confidence; that is what separates a real published rate
// from a scraped fragment.
function tagEvidence(v, key) {
  const f = v.filters;
  const pick = (...keys) => Object.fromEntries(keys.filter((k) => f[k] != null).map((k) => [k, f[k]]));
  if (/price/.test(key))
    return pick(
      key, "price_min", "price_max", "bride_price_min", "bride_price_max",
      "party_price_min", "party_price_max", "trial_price", "minimum_spend",
      "price_basis", "price_kind", "price_confidence", "price_quote",
    );
  if (/capacity/.test(key)) return pick(key, "capacity_max", "capacity_quote");
  return pick(key);
}

const items = [];
for (const r of results) {
  const v = vendors.get(r.vendor_id);
  if (!v) continue;
  for (const c of r.contradictions ?? []) {
    const entry = v.entries.find((e) => e.id === c.entry_id);
    items.push({ v, c, entry, evidence: tagEvidence(v, c.key) });
  }
}
console.log(`contradictions to adjudicate: ${items.length}`);
if (!items.length) process.exit(0);

const CONTRACT = `Each item is a wedding vendor whose recon (notes written by people who
looked into it) disagrees with its own structured tags. Decide which side is
right and fix the wrong one. You have only what is shown - no research.

The most common case: the tag holds a price the extraction pulled off the
vendor's site, but that number is NOT a wedding rate. It is an add-on (a photo
booth, a karaoke rental), an a la carte item (a menu price like "mahi $15"), a
deposit, or a different service's price (videography, not the DJ). The recon
says so. Here the TAG is wrong.

The other case: the recon is stale or was written without seeing a page the
extraction did read, and the tag carries a solid published quote. Here the RECON
is wrong.

Return one verdict per item:

- fix_recon: the tag's quote is a real published fact and the recon states
  something false about it. Give the exact false substring from the entry and a
  short true replacement.
- remove_tag: the tag is a misextraction the recon exposes (an add-on, a
  deposit, the wrong service, an a la carte line). It should be deleted.
- correct_tag: the recon states the real value explicitly. Give the value and
  the verbatim recon sentence it comes from.
- decline: both are defensible, the conflict is not real (a venue can require
  in-house bartenders AND allow BYO alcohol), or you cannot tell. When unsure,
  decline - a wrong fix is worse than a standing disagreement.

PROSE for fix_recon: no em or en dashes, US spelling, no marketing words, never
mention sources or how anything was found, no backslash-n. "old" must be an
exact substring of the entry field, copied verbatim.

OUTPUT one JSON object per item, one per line, no prose, no fence:

{"vendor_id":"<id>","key":"<attribute>","verdict":"fix_recon","entry_id":"<id>","field":"notes|price_details","old":"<verbatim>","new":"<replacement>","reason":"<short>"}
{"vendor_id":"<id>","key":"<attribute>","verdict":"remove_tag","reason":"<why it is a misextraction>"}
{"vendor_id":"<id>","key":"<attribute>","verdict":"correct_tag","value":<value>,"quote":"<verbatim recon sentence>","reason":"<short>"}
{"vendor_id":"<id>","key":"<attribute>","verdict":"decline","reason":"<short>"}`;

mkdirSync(join(dir, "calls-fix"), { recursive: true });
let n = 0;
for (let i = 0; i < items.length; i += PER_CALL) {
  const chunk = items.slice(i, i + PER_CALL);
  const id = `call-${String(++n).padStart(3, "0")}`;
  const body = chunk
    .map((it, j) => {
      const e = it.entry;
      const recon = e
        ? ["price_text", "price_details", "notes"]
            .filter((f) => e[f])
            .map((f) => `    ${f}: ${e[f]}`)
            .join("\n")
        : "    (entry not found)";
      return (
        `ITEM ${j + 1}  vendor ${it.v.name} (${it.v.id}), type ${it.v.vendor_type}\n` +
        `  disputed tag: ${it.c.key}\n` +
        `  tag + evidence: ${JSON.stringify(it.evidence)}\n` +
        `  the recon appears to say: "${it.c.recon}"\n` +
        `  full entry ${e?.id ?? "?"} (${e?.is_bot ? "bot" : "not bot"}):\n${recon}`
      );
    })
    .join("\n\n");
  writeFileSync(
    join(dir, "calls-fix", `${id}.json`),
    JSON.stringify(
      {
        custom_id: id,
        params: { model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: "adaptive" }, system: CONTRACT, messages: [{ role: "user", content: body }] },
      },
      null,
      2,
    ),
  );
}
console.log(`${n} adjudication call file(s) -> ${join(dir, "calls-fix")}`);
console.log(`Next: batch.mjs submit --work ${WORK} --calls calls-fix --results results-fix.jsonl`);
