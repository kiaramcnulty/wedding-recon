#!/usr/bin/env node
/**
 * Phase 2 - turn the export into Batch API call files.
 *
 *   node scripts/reconcile/build-calls.mjs --work co-all [--per-call 20] [--type venue]
 *
 * Reads  data/reconcile/<work>/vendors.jsonl
 * Writes data/reconcile/<work>/calls/call-NNN.json   ({custom_id, params} each)
 *
 * Calls are grouped BY VENDOR TYPE because the allowed-value vocabulary is
 * per type: batching a venue with a florist would mean carrying both
 * vocabularies in one prompt and inviting cross-type values.
 *
 * The output contract asks for EDITS, not rewritten entries. Output bills at
 * 5x input, and a rewritten entry runs 6-9k tokens against roughly 100 for the
 * clause to append - so the edit shape is most of what makes this pass cheap.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { workdir, readJsonl, arg } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: build-calls.mjs --work <name> [--per-call N] [--type T]");
  process.exit(1);
}
const PER_CALL = Number(arg("per-call", 20));
const ONLY = arg("type");
const MODEL = arg("model", "claude-sonnet-5");
/**
 * max_tokens caps THINKING PLUS RESPONSE, not the response alone.
 *
 * Sonnet 5 runs adaptive thinking whenever `thinking` is omitted, so the first
 * pilot truncated 2 of 3 calls at 16000 even though the visible output averaged
 * 196 bytes per vendor - the reasoning over 20 vendors was the whole budget.
 * The Batch API bills tokens actually produced, so a generous ceiling costs
 * nothing when it is not used and is pure insurance when it is. Same reasoning
 * that walked draft.mjs up to 96000.
 */
const MAX_TOKENS = Number(arg("max-tokens", 48000));

// Pilot sizing. Cap the vendors built into calls so a first run can be read by
// hand before the other ~1,900 are spent. Takes an evenly-spaced sample rather
// than the first N, so the pilot is not all one city or one seeding batch.
const LIMIT = Number(arg("limit", 0));

const dir = workdir(WORK);
let rows = readJsonl(join(dir, "vendors.jsonl")).filter(
  (r) => !ONLY || r.vendor_type === ONLY,
);
if (LIMIT > 0 && rows.length > LIMIT) {
  const step = rows.length / LIMIT;
  rows = Array.from({ length: LIMIT }, (_, i) => rows[Math.floor(i * step)]);
}

/** Render one type's attribute vocabulary, including every allowed value. */
function vocabulary(type) {
  const defs = VENDOR_FILTERS[type] ?? [];
  return defs
    .map((d) => {
      if (d.kind === "multi")
        return `- ${d.key} (list) allowed values: ${d.options.map((o) => o.value).join(", ")}`;
      if (d.kind === "bool") return `- ${d.key} (true/false)`;
      const parts = [`- ${d.key} (number range: ${d.lo ?? d.key}${d.hi ? ` / ${d.hi}` : ""})`];
      if (d.basis) parts.push(`  basis for this type is "${d.basis}"`);
      return parts.join("\n");
    })
    .join("\n");
}

const CONTRACT = `You are reconciling two records of the same wedding vendor so they agree.

One record is a set of structured tags. The other is recon: short notes written by
people who looked into the vendor. They disagree, and your job is to close the gap
in both directions, using ONLY what is in front of you. You have no research, no
web access, and no knowledge of this vendor beyond this prompt.

DIRECTION A - a tag exists, but no recon entry tells the reader about it.
Append a short clause to one of the vendor's BOT entries so a couple reading the
recon learns the fact. The test is whether they learn it, not whether the exact
word appears: an entry saying "they let you bring in your own caterer" already
documents catering_policy outside_allowed, and needs no edit.

DIRECTION B - a recon entry states a fact, but the matching tag is missing.
Propose the tag, with the verbatim sentence you read it from.

RULES THAT CAUSE REAL DAMAGE IF BROKEN

1. Never write a value you cannot point at. A missing tag quietly ranks a vendor
   lower. A WRONG tag removes them from the map entirely for couples searching
   that filter. Skipping costs less than guessing, every time.

2. Never write false, and never write a negative you inferred from silence. An
   entry that does not mention a shuttle is not evidence there is no shuttle.
   Only write false if an entry says the vendor does NOT have the thing.

3. A list value asserts completeness. Adding a value to a list that already has
   values is safe. CREATING a list from nothing says "this and nothing else" - so
   only create one when the entry reads as a full account of that attribute. If
   the entry mentions a barn in passing, that is not a complete setting list.

4. Only ever edit entries marked is_bot. Entries by real people are their own
   words. Never touch them, and never quote them into another entry.

5. Never create a new entry. Append only, and only to bot entries.

6. If a tag CONTRADICTS what an entry says, write nothing for it - report it under
   contradictions. Do not write prose to match a tag the recon disagrees with.

WRITING THE CLAUSE

Match the voice of the entry you are appending to. These read as individual
people, and a corpus where every entry gained the same sentence shape reads as
machine-written. Vary it.

Match the voice, not the habits. Some existing entries narrate how their
information was gathered - a site that would not load, an HTTP error, a search
that came back empty. That is a defect in those entries, not a style to copy.
Never write anything of that kind, whatever the entry you are appending to does.

- No em dashes or en dashes anywhere. Use a comma, a period, or a hyphen.
- US spelling.
- Plain wording. No marketing language: not stunning, breathtaking, nestled,
  boasts, elevate, unforgettable, magical, exquisite, picturesque.
- Never mention research, sources, sites, reviews, dossiers, batches, data, or
  anything about how the information was obtained. Write about the VENDOR.
- Do not write the two characters backslash-n. Separate points with a space.
- Short. One clause or one sentence. You are adding a fact, not a paragraph.
- At most THREE attributes in one appended clause. Four or more turns into a
  comma-list that reads as a dump of structured fields rather than something a
  person wrote: "holds up to 500 guests, requires in-house catering, keeps
  ceremonies indoors, and includes a getting ready suite". Split them across
  entries, or leave the least useful one undocumented and say so in skipped.
- Vary how you say the recurring ones. Across a whole region these attributes
  come up constantly, and if every vendor gets "a getting ready suite for the
  wedding party" the corpus reads as one writer with a template.

Prefer appending to the SHORTEST bot entry, so several tags spread across
entries rather than bloating one. Use a different entry only when one is clearly
the right home for the fact.

OUTPUT

One JSON object per vendor, one per line, nothing else - no prose, no markdown
fence. Emit only what changes; omit empty arrays.

{"vendor_id":"<id>",
 "recon_edits":[{"entry_id":"<id>","field":"notes","append":"<clause>","documents":["<tag key>"]}],
 "filter_writes":[{"key":"<tag key>","value":<value>,"quote":"<verbatim sentence from the entry>","entry_id":"<id>"}],
 "contradictions":[{"key":"<tag key>","tag":<current value>,"recon":"<what the entry says>","entry_id":"<id>"}],
 "skipped":[{"key":"<tag key>","why":"<short reason>"}]}

field is "notes" or "price_details". For a price write, also include "basis"
(package, per_person, per_hour, per_night, per_gown) and "kind" (range,
starting_at, single_figure). A number you cannot place on a basis is worse than
no number, because it gets compared on the wrong axis - skip it instead.`;

// --- assemble ---------------------------------------------------------------

const byType = {};
for (const r of rows) (byType[r.vendor_type] ??= []).push(r);

mkdirSync(join(dir, "calls"), { recursive: true });

let n = 0;
let vendors = 0;
const manifest = [];

for (const [type, list] of Object.entries(byType)) {
  const vocab = vocabulary(type);
  if (!vocab) {
    console.log(`  ${type}: no filter definitions, skipped (${list.length} vendors)`);
    continue;
  }
  for (let i = 0; i < list.length; i += PER_CALL) {
    const chunk = list.slice(i, i + PER_CALL);
    const id = `call-${String(++n).padStart(3, "0")}`;

    const body = chunk
      .map((v) => {
        const tags = Object.entries(v.filters)
          .filter(([, val]) => val !== null && !(Array.isArray(val) && val.length === 0))
          .map(([k, val]) => `    ${k}: ${JSON.stringify(val)}`)
          .join("\n");
        const entries = v.entries
          .map(
            (e) =>
              `    entry ${e.id} (${e.is_bot ? "BOT - editable" : "REAL PERSON - do not touch"}` +
              `, by ${e.username ?? "unknown"}, ${e.length} chars)\n` +
              (e.price_text ? `      price_text: ${e.price_text}\n` : "") +
              (e.price_details ? `      price_details: ${e.price_details}\n` : "") +
              `      notes: ${e.notes ?? ""}`,
          )
          .join("\n");
        return `VENDOR ${v.id}\n  name: ${v.name} (${v.city ?? "?"})\n  tags:\n${tags || "    (none)"}\n  recon:\n${entries}`;
      })
      .join("\n\n");

    writeFileSync(
      join(dir, "calls", `${id}.json`),
      JSON.stringify(
        {
          custom_id: id,
          params: {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            // Explicit rather than inherited. Every write here is a judgment
            // call the couple cannot audit, so the reasoning is worth paying
            // for - but it has to be a decision, not a default nobody noticed.
            thinking: { type: "adaptive" },
            system: `${CONTRACT}\n\nATTRIBUTES FOR VENDOR TYPE "${type}" - a value not listed here is invalid:\n${vocab}`,
            messages: [{ role: "user", content: body }],
          },
        },
        null,
        2,
      ),
    );
    manifest.push({ call: id, type, vendors: chunk.length });
    vendors += chunk.length;
  }
}

writeFileSync(join(dir, "calls/manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n${n} call files covering ${vendors} vendors -> ${join(dir, "calls")}`);
for (const [type, list] of Object.entries(byType))
  console.log(`  ${type.padEnd(10)} ${list.length}`);
