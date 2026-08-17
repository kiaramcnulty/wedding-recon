#!/usr/bin/env node
/**
 * Draft thin recon entries for vendors that have filter tags but NO recon at
 * all (Kiara, 2026-08-09). These 138 vendors are reachable by no append - there
 * is nothing to append to - so the only way to document their tags in prose is
 * to create an entry.
 *
 *   node scripts/reconcile/build-creates.mjs
 *
 * Reads  data/reconcile/creates-targets.json  ({targets, bots})
 * Writes data/reconcile/creates/calls/*.json
 *
 * The content is ONLY the tags. There is no research and no prior recon, so the
 * contract is deliberately strict: state the tagged facts in one or two plain
 * lines and add NOTHING. A thin true line beats an invented paragraph. Distinct
 * bot per vendor, spread across the roster so the corpus does not read as one
 * author.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { ROOT, arg } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";

const PER_CALL = Number(arg("per-call", 15));
const MODEL = arg("model", "claude-sonnet-5");
const MAX_TOKENS = Number(arg("max-tokens", 32000));

const src = JSON.parse(readFileSync(resolve(ROOT, "data/reconcile/creates-targets.json"), "utf8"));
const { targets, bots } = src;
const dir = resolve(ROOT, "data/reconcile/creates");
mkdirSync(join(dir, "calls"), { recursive: true });

// Render a vendor's tags as readable "label: value" lines using the same
// option labels the UI shows, so the model states the human-facing fact rather
// than the raw enum token.
function labelFor(type, key, value) {
  const def = (VENDOR_FILTERS[type] ?? []).find((d) => d.key === key || d.lo === key || d.hi === key);
  if (!def) return null;
  const name = def.label ?? key;
  if (def.kind === "multi") {
    const opts = Object.fromEntries(def.options.map((o) => [o.value, o.label]));
    const vals = (Array.isArray(value) ? value : [value]).map((v) => opts[v] ?? v);
    return `${name}: ${vals.join(", ")}`;
  }
  if (def.kind === "bool") return value ? name : `${name}: no`;
  return `${name}: ${value}`;
}

function tagLines(v) {
  const out = [];
  const seen = new Set();
  for (const [k, val] of Object.entries(v.filters)) {
    if (val == null || (Array.isArray(val) && !val.length)) continue;
    if (/quote|confidence|basis|kind/.test(k)) continue;
    const l = labelFor(v.vendor_type, k, val);
    if (l && !seen.has(l)) { out.push(l); seen.add(l); }
  }
  return out;
}

const CONTRACT = `You are writing a very short recon note for a wedding vendor. You are given a
list of known facts about the vendor and nothing else - no reviews, no website,
no other information.

Write one or two plain sentences that state those facts. That is the whole job.

- Say ONLY what the facts list says. Do not add, guess, or embellish anything -
  not atmosphere, not quality, not reputation, not who it suits. If the facts are
  thin, the note is thin. One short line is a fine note.
- Plain, natural wording, as a person jotting a quick note. Not a spec sheet:
  "Holds up to 150 guests and has an on-site getting-ready suite" - not
  "Capacity: 150. Getting-ready suite: yes."
- No marketing words (stunning, nestled, boasts, elevate, magical, exquisite).
- No em dashes or en dashes. US spelling. Never mention data, tags, sources, or
  how the information was obtained. Do not write backslash-n.
- If a price fact is present, put it in price_text as a plain line that states
  the figure with a dollar sign (for example "Gowns from $750" or "Bride $480"),
  never a bare number like "750". If no price fact is present, price_text says
  there is no published pricing, in plain words.

OUTPUT one JSON object per vendor, one per line, no prose, no fence:
{"vendor_id":"<id>","notes":"<one or two sentences>","price_text":"<price line or no-pricing line>"}`;

let n = 0;
for (let i = 0; i < targets.length; i += PER_CALL) {
  const chunk = targets.slice(i, i + PER_CALL);
  const id = `call-${String(++n).padStart(3, "0")}`;
  const body = chunk
    .map((v) => {
      const lines = tagLines(v);
      return `VENDOR ${v.id}\n  name: ${v.name} (${v.city ?? "?"}), type ${v.vendor_type}\n  known facts:\n${lines.map((l) => `    - ${l}`).join("\n") || "    (none)"}`;
    })
    .join("\n\n");
  writeFileSync(
    join(dir, "calls", `${id}.json`),
    JSON.stringify(
      { custom_id: id, params: { model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: "adaptive" }, system: CONTRACT, messages: [{ role: "user", content: body }] } },
      null,
      2,
    ),
  );
}
console.log(`${n} draft call file(s) for ${targets.length} vendors -> ${join(dir, "calls")}`);
console.log(`Next: batch.mjs submit --work creates --calls calls --results results.jsonl`);
