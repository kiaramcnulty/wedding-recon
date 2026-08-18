#!/usr/bin/env node
/**
 * On-write reconcile, phase 2 - turn the dirty-vendor export into Batch calls.
 *
 *   node scripts/reconcile/daily-build-calls.mjs --work daily-20260812 [--per-call 20]
 *
 * Reads  data/reconcile/<work>/vendors.jsonl
 * Writes data/reconcile/<work>/calls/call-NNN.json   ({custom_id, params} each)
 *
 * Then run the SHARED driver (batch.mjs) verbatim:
 *   node scripts/reconcile/batch.mjs submit  --work <name>
 *   node scripts/reconcile/batch.mjs status  --work <name>
 *   node scripts/reconcile/batch.mjs collect --work <name>
 *
 * This is tags-only. The offline build-calls asks for prose edits AND tag writes
 * AND a report of contradictions it will NOT act on. This asks for tag changes
 * only - create, extend, overwrite (a resolved contradiction), retract - and
 * never edits a recon entry. That is why a human-authored entry is a valid
 * source here: we read it, we never rewrite it.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { workdir, readJsonl, arg, has } from "./lib.mjs";
import { VENDOR_FILTERS } from "../../lib/constants/vendor-filters.ts";
import { fetchSiteText } from "./site-fetch.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: daily-build-calls.mjs --work <name> [--per-call N] [--no-mine]");
  process.exit(1);
}
const PER_CALL = Number(arg("per-call", 20));
// A call carrying a vendor's own-site text is far larger, so mining vendors are
// chunked small. The site text (~24k chars/vendor) is the size driver, not the
// output, so this bounds input; output stays a few drafted entries per call.
const PER_SITE_CALL = Number(arg("per-site-call", 3));
const MINE = !has("no-mine"); // --no-mine builds tag-reconcile-only calls (no site fetch)
const MODEL = arg("model", "claude-sonnet-5");
const MAX_TOKENS = Number(arg("max-tokens", 48000));

const dir = workdir(WORK);
const rows = readJsonl(join(dir, "vendors.jsonl"));
if (rows.length === 0) {
  console.log("No dirty vendors in the export. Nothing to build.");
  process.exit(0);
}

// Websites just found by daily-websites.mjs are in the DB but not in vendors.jsonl
// (exported before the backfill), so merge them in: a vendor's effective website
// is the one it had OR the one just backfilled.
const found = new Map();
if (existsSync(join(dir, "websites.jsonl"))) {
  for (const r of readJsonl(join(dir, "websites.jsonl"))) if (r.website) found.set(r.id, r.website);
}
const effectiveWebsite = (v) => v.website || found.get(v.id) || null;

/** Render one type's attribute vocabulary, including every allowed value. */
function vocabulary(type) {
  const defs = VENDOR_FILTERS[type] ?? [];
  return defs
    .map((d) => {
      if (d.kind === "multi")
        return `- ${d.key} (list) allowed values: ${d.options.map((o) => o.value).join(", ")}`;
      if (d.kind === "bool") return `- ${d.key} (true/false)`;
      const lo = d.lo ?? d.key;
      const head = `- ${lo}${d.hi ? ` / ${d.hi}` : ""} (number${d.basis ? `, basis "${d.basis}"` : ""})`;
      const hint = d.hi
        ? `    extend ${lo} to a lower figure, ${d.hi} to a higher one`
        : /max/.test(lo)
          ? `    extend to a higher figure if recon shows a larger value`
          : /min/.test(lo)
            ? `    extend to a lower figure if recon shows a smaller value`
            : `    a single figure; overwrite only on a clear contradiction`;
      return `${head}\n${hint}`;
    })
    .join("\n");
}

const CONTRACT = `You are keeping a wedding vendor's structured filter tags in agreement with its
recon: short notes written by people (and bots) who looked into the vendor. A new
recon entry just landed, so the tags may be stale. Reconcile them using ONLY what
is in front of you - no research, no web access, no outside knowledge of this
vendor. You change TAGS only. You never edit a recon entry, and you never write
prose.

For every attribute, compare what the recon entries say against the current tag,
and decide ONE of:

- CREATE - the recon states a fact and there is no tag for it yet. Emit a write
  with op "create".
- AGREE - the recon matches the current tag. Do nothing. Emit nothing.
- EXTEND - the recon broadens the current tag. A list gains a value it did not
  have; a number range should reach further (a package higher than the current
  max, a figure lower than the current min). Emit a write with op "extend": for a
  list, the SINGLE new value; for a range, the specific numeric key and the new
  figure.
- OVERWRITE - the recon directly contradicts the current tag (not merely adds to
  it). Resolve the conflict and emit a write with op "overwrite" carrying the
  winning value. See RESOLVING A CONTRADICTION.
- RETRACT - a current tag's only support was a recon entry that is no longer
  present, and nothing now on the vendor states it. Emit it under "retract".
  Do NOT retract a tag merely because the current entries do not mention it -
  silence is not a reason to remove a tag.

RESOLVING A CONTRADICTION

Two things decide who wins, in order:
  1. A human-authored entry beats a bot-authored one. The entries are labelled
     HUMAN or BOT. A real person who visited the vendor outranks a bot that read
     a listing.
  2. Within the same kind, weight of evidence: how many entries state each side,
     and how firmly (a published rate beats an offhand guess). More, firmer
     evidence wins.
Count only entries that make an EXPLICIT claim. An entry that is silent on the
attribute is not a vote either way. If after this the sides are genuinely even,
do NOT overwrite - leave the current tag and record it under "skipped" so a human
can look. Fill human_support and bot_support with the counts you used.

RULES THAT CAUSE REAL DAMAGE IF BROKEN

1. Never write a value you cannot point at. A missing tag quietly ranks a vendor
   lower; a WRONG tag removes them from the map for couples searching that filter.
   Skipping costs less than guessing, every time.

2. Never write false, and never write a negative you inferred from silence. An
   entry that does not mention a shuttle is not evidence there is no shuttle. Only
   write false when an entry says the vendor does NOT have the thing.

3. A list value asserts completeness. EXTENDING a list (adding one value) only
   adds matches and is safe. CREATING a list from nothing says "this and nothing
   else", so only create one when an entry reads as a full account of that
   attribute, not a passing mention.

4. A tag marked LOCKED was set by a human through the app. Never change, extend,
   overwrite, or retract it. Leave it exactly as it is.

5. Every write carries "quote": the verbatim sentence from the entry you read the
   value from, and "entry_id": that entry. The quote must appear in that entry
   word for word - it is checked mechanically. A value you cannot quote is a value
   you are guessing; skip it.

6. For a price (any number range key whose name contains "price"), include
   "basis" (package, per_person, per_hour, per_night, per_gown) and "kind"
   (range, starting_at, single_figure). A number you cannot place on a basis is
   worse than none, because it gets compared on the wrong axis. Skip it instead.

MINING THE WEBSITE (only for a vendor whose block includes a WEBSITE section)

The WEBSITE section is the vendor OWN site text. Read it for filter attributes
this vendor does not already have a tag or an entry for, and capture each as BOTH
a tag and a short recon entry - a tag may exist only if recon prose documents it,
so you write the prose that documents it.

- Mine only facts the site plainly states: a published price, a stated capacity,
  an explicit "we allow outside catering", a named service. If the site does not
  say it, do not mine it. No guessing, no marketing restatement.
- Do NOT mine a fact a current tag or an existing entry already covers - that is
  the reconcile job above, not mining.
- Write ONE recon entry per vendor capturing everything you mined, in the natural
  voice of a couple who looked into the vendor: plain and specific, no marketing
  words, and no mention of a website, page, or how you found it. price_text and
  price_details are REQUIRED (state what the site lists, or that it lists none).
- Each mined tag carries a "quote" that is a VERBATIM substring of your own entry
  text (notes / price_text / price_details) - the tag and its evidence must agree.
- If the site yields nothing new, omit "site" entirely.

OUTPUT

Emit EXACTLY ONE JSON object per vendor listed, one per line, nothing else - no
prose, no markdown fence. Every vendor gets a line even with nothing to do: emit
the bare {"vendor_id":"<id>"}. Omit arrays and objects that are empty.

{"vendor_id":"<id>",
 "writes":[{"key":"<tag key>","value":<value>,"op":"create|extend|overwrite","quote":"<verbatim sentence>","entry_id":"<id>","basis":"<price only>","kind":"<price only>","human_support":<n>,"bot_support":<n>,"note":"<short why, for overwrite or a false value>"}],
 "retract":[{"key":"<tag key>","reason":"<the supporting entry is gone>"}],
 "skipped":[{"key":"<tag key>","why":"<short reason>"}],
 "site":{"entry":{"notes":"<one couple-voiced note capturing the mined facts>","price_text":"<required>","price_details":"<required>"},
         "tags":[{"key":"<tag key>","value":<value>,"quote":"<verbatim substring of the entry above>","basis":"<price only>","kind":"<price only>"}]}}

human_support / bot_support / note are only needed on an "overwrite" (or a write
whose value is false). "site" is only for a vendor whose block had a WEBSITE
section and yielded a genuinely new fact. Omit them elsewhere.`;

// --- assemble ---------------------------------------------------------------

/** One vendor block for the call body; appends its own-site text when mining. */
function vendorBlock(v, siteText) {
  const tags =
    Object.entries(v.filters)
      .filter(([, val]) => val !== null && !(Array.isArray(val) && val.length === 0))
      .map(([k, val]) => {
        const src = v.filters_meta?.[k]?.source;
        const flag =
          src === "manual"
            ? "  [LOCKED - human set, do not change]"
            : `  [source: ${src ?? "extraction"}]`;
        return `    ${k}: ${JSON.stringify(val)}${flag}`;
      })
      .join("\n") || "    (none)";
  const entries =
    v.entries
      .map(
        (e) =>
          `    entry ${e.id} (${e.is_bot ? "BOT" : "HUMAN"}, by ${e.username ?? "unknown"}):\n` +
          (e.price_text ? `      price_text: ${e.price_text}\n` : "") +
          (e.price_details ? `      price_details: ${e.price_details}\n` : "") +
          (e.service_region ? `      service_region: ${e.service_region}\n` : "") +
          `      notes: ${e.notes ?? ""}`,
      )
      .join("\n") || "    (no active entries - retract candidates only)";
  let block = `VENDOR ${v.id}\n  name: ${v.name} (${v.city ?? "?"})\n  current tags:\n${tags}\n  recon entries:\n${entries}`;
  if (siteText)
    block += `\n  WEBSITE (this vendor own site text - mine per MINING THE WEBSITE):\n${siteText}`;
  return block;
}

function writeCall(id, type, vocab, chunk, sites) {
  const body = chunk.map((v) => vendorBlock(v, sites?.get(v.id) ?? null)).join("\n\n");
  writeFileSync(
    join(dir, "calls", `${id}.json`),
    JSON.stringify(
      {
        custom_id: id,
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: "adaptive" },
          system: `${CONTRACT}\n\nATTRIBUTES FOR VENDOR TYPE "${type}" - a key or value not listed here is invalid:\n${vocab}`,
          messages: [{ role: "user", content: body }],
        },
      },
      null,
      2,
    ),
  );
}

const byType = {};
for (const r of rows) (byType[r.vendor_type] ??= []).push(r);

mkdirSync(join(dir, "calls"), { recursive: true });

let n = 0;
let built = 0;
let mined = 0;
let siteFail = 0;
const manifest = [];

for (const [type, list] of Object.entries(byType)) {
  const vocab = vocabulary(type);
  if (!vocab) {
    console.log(`  ${type}: no filter definitions, skipped (${list.length} vendors)`);
    continue;
  }

  // Fetch own-site text for every vendor that has a website (sequential - the
  // dirty set is a trickle). Only a vendor we actually got text for is "mined";
  // everything else (no site, or a failed fetch) batches at PER_CALL for tag
  // reconcile only, exactly as before.
  const sites = new Map();
  for (const v of MINE ? list.filter((v) => effectiveWebsite(v)) : []) {
    const r = await fetchSiteText(effectiveWebsite(v));
    if (r?.text) {
      sites.set(v.id, r.text);
      mined++;
    } else {
      siteFail++;
      console.log(`  site fetch failed for ${v.name}: ${r?.error ?? "no text"}`);
    }
  }
  const withSite = list.filter((v) => sites.has(v.id));
  const noSite = list.filter((v) => !sites.has(v.id));

  // Mining calls: small chunks (site text is the size driver), each carrying text.
  for (let i = 0; i < withSite.length; i += PER_SITE_CALL) {
    const chunk = withSite.slice(i, i + PER_SITE_CALL);
    const id = `call-${String(++n).padStart(3, "0")}`;
    writeCall(id, type, vocab, chunk, sites);
    manifest.push({ call: id, type, vendors: chunk.length, mining: true });
    built += chunk.length;
  }
  // Reconcile-only calls: the usual PER_CALL batches, no site text.
  for (let i = 0; i < noSite.length; i += PER_CALL) {
    const chunk = noSite.slice(i, i + PER_CALL);
    const id = `call-${String(++n).padStart(3, "0")}`;
    writeCall(id, type, vocab, chunk, null);
    manifest.push({ call: id, type, vendors: chunk.length, mining: false });
    built += chunk.length;
  }
}

writeFileSync(join(dir, "calls", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(
  `\n${n} call files covering ${built} vendors ` +
    `(${mined} carrying own-site text${siteFail ? `, ${siteFail} site fetches failed` : ""}) -> ${join(dir, "calls")}`,
);
for (const [type, list] of Object.entries(byType))
  console.log(`  ${type.padEnd(10)} ${list.length}`);
console.log(`\nNext: node scripts/reconcile/batch.mjs submit --work ${WORK}`);
