#!/usr/bin/env node
/**
 * Corrections - the third direction, run as its own pass over the contradiction
 * set (Kiara, 2026-08-09).
 *
 *   node scripts/reconcile/build-corrections.mjs --work co-all
 *
 * Reads  <work>/results.jsonl   (the contradictions the A/B pass reported)
 * Writes <work>/calls-fix/call-NNN.json
 *
 * A contradiction is a recon entry that states something its own tags disprove:
 * Love Wedding Chapel's entry says "genuinely zero data here" while the tags
 * hold "Venue Rental Prices Starting at $375" from a published page. A false
 * statement is worse than a silent gap - it makes a couple skip a vendor that
 * was in budget - so where the tag is well-evidenced, correct the prose to
 * state the true fact.
 *
 * TWO THINGS MAKE THIS SAFE, because unlike the append pass this REPLACES prose.
 *
 * 1. Clear-evidence gate. We only correct FROM a tag we can trust over the
 *    recon, which means a tag that carries its own verbatim quote: price and
 *    capacity. A garbled quote (Gateway Canyons' "$2,000 $3,500 $5,000
 *    $1,000 $2,000 $3,000wedding site fee") is dropped here and never reaches
 *    the model - the extraction is not automatically right. Attributes with no
 *    independent quote (catering, setting, ceremony) stay reports: trusting the
 *    tag over the recon there would be trusting the extraction blind.
 *
 * 2. Clause-level replace. The model returns the exact false substring and its
 *    replacement, not a rewritten field. Apply string-replaces only that
 *    clause, so an append that landed elsewhere in the same entry survives, and
 *    a clause that is no longer present is skipped rather than forced.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { workdir, readJsonl, arg } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: build-corrections.mjs --work <name> [--per-call 15]");
  process.exit(1);
}
const PER_CALL = Number(arg("per-call", 15));
const MODEL = arg("model", "claude-sonnet-5");
const MAX_TOKENS = Number(arg("max-tokens", 32000));

const dir = workdir(WORK);
const results = readJsonl(join(dir, "results.jsonl"));
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));

// A quote we cannot trust: a digit glued to a letter ("3,000wedding"), or a run
// of three or more dollar figures with nothing between them. Both are scrape
// concatenation, not a published sentence.
const GARBLED = /\d[A-Za-z]|(?:\$\s?[\d,]+[^A-Za-z$]{0,3}){3,}/;

/** Evidence for a correctable attribute, or null if the bar is not met. */
function evidence(key, filters) {
  if (/price/.test(key)) {
    const quote = filters.price_quote;
    if (filters.price_confidence !== "published") return null; // published only
    if (!quote || GARBLED.test(quote)) return null;
    return {
      kind: "price",
      quote,
      value: {
        price_min: filters.price_min,
        price_max: filters.price_max,
        price_basis: filters.price_basis,
        price_kind: filters.price_kind,
      },
    };
  }
  if (/capacity/.test(key)) {
    const quote = filters.capacity_quote;
    if (!quote || GARBLED.test(quote)) return null;
    return { kind: "capacity", quote, value: filters.capacity_max };
  }
  return null; // no independent quote for this attribute - stays a report
}

// --- assemble candidates ----------------------------------------------------

const candidates = [];
let reportedOnly = 0;

for (const r of results) {
  const v = vendors.get(r.vendor_id);
  if (!v) continue;
  for (const c of r.contradictions ?? []) {
    const ev = evidence(c.key, v.filters);
    if (!ev) {
      reportedOnly++;
      continue;
    }
    const entry = v.entries.find((e) => e.id === c.entry_id);
    if (!entry || !entry.is_bot) {
      reportedOnly++;
      continue;
    }
    candidates.push({ vendor: v, contradiction: c, evidence: ev, entry });
  }
}

console.log(`contradictions in results:     ${results.reduce((a, r) => a + (r.contradictions?.length ?? 0), 0)}`);
console.log(`correctable (clear evidence):  ${candidates.length}`);
console.log(`left as reports (weak/no quote):${String(reportedOnly).padStart(4)}\n`);

if (!candidates.length) {
  console.log("Nothing correctable. No call files written.");
  process.exit(0);
}

const CONTRACT = `You are fixing recon entries that state something their own vendor's
structured data disproves. Each item below gives you: the structured fact and
the VERBATIM published quote it came from, and a recon entry that says otherwise.

For each item, decide between two actions.

CORRECT - the quote is a solid published fact and the recon genuinely states
something false about it. Return the exact false substring from the entry, and a
short true replacement. The replacement states the fact plainly, in the entry's
own voice.

DECLINE - the quote does not actually support the fact, the two statements are
not really in conflict (a venue can require in-house bartenders AND allow you to
bring your own alcohol - that is not a contradiction), or the recon is defensibly
accurate. When unsure, decline. A wrong correction writes a false fact onto a
vendor page, which is worse than leaving a hedge in place.

THE REPLACEMENT

- old must be an EXACT substring of the entry field shown, copied character for
  character, long enough to be unique in that field. Do not paraphrase it.
- new states the corrected fact and nothing else. For a price, include the
  figure. Keep it about the same length as old, so the surrounding text still
  reads.
- No em dashes or en dashes. US spelling. No marketing words. Never mention
  sources, sites, data, or how anything was found. Do not write backslash-n.

OUTPUT - one JSON object per item, one per line, no prose, no fence:

{"vendor_id":"<id>","entry_id":"<id>","field":"notes|price_text|price_details",
 "action":"correct","old":"<verbatim false substring>","new":"<true replacement>","fact":"<the fact in a few words>"}

or

{"vendor_id":"<id>","entry_id":"<id>","action":"decline","reason":"<short why>"}`;

mkdirSync(join(dir, "calls-fix"), { recursive: true });

let n = 0;
for (let i = 0; i < candidates.length; i += PER_CALL) {
  const chunk = candidates.slice(i, i + PER_CALL);
  const id = `call-${String(++n).padStart(3, "0")}`;
  const body = chunk
    .map((c, j) => {
      const e = c.entry;
      const fields = ["price_text", "price_details", "notes"]
        .filter((f) => e[f === "price_text" ? "price_text" : f])
        .map((f) => `      ${f}: ${e[f] ?? ""}`)
        .join("\n");
      return (
        `ITEM ${j + 1}\n` +
        `  vendor: ${c.vendor.name} (${c.vendor.id})\n` +
        `  attribute: ${c.contradiction.key}\n` +
        `  structured fact: ${JSON.stringify(c.evidence.value)}\n` +
        `  published quote: "${c.evidence.quote}"\n` +
        `  the recon appears to say: "${c.contradiction.recon}"\n` +
        `  entry ${e.id} (bot, by ${e.username ?? "?"}):\n${fields}`
      );
    })
    .join("\n\n");

  writeFileSync(
    join(dir, "calls-fix", `${id}.json`),
    JSON.stringify(
      {
        custom_id: id,
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: "adaptive" },
          system: CONTRACT,
          messages: [{ role: "user", content: body }],
        },
      },
      null,
      2,
    ),
  );
}

console.log(`${n} correction call file(s) -> ${join(dir, "calls-fix")}`);
console.log(
  `\nNext:\n  node scripts/reconcile/batch.mjs submit  --work ${WORK} --calls calls-fix --results results-fix.jsonl` +
    `\n  (status / collect the same way, then gate-corrections.mjs)`,
);
