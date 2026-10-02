/**
 * Source evidence for reconcile writes: every fact a reconcile pass adds to recon
 * prose, and every tag it writes off a BOT entry, must carry a verbatim quote
 * from a HARVESTED SOURCE - the vendor's own fetched site pages, its harvested
 * Google reviews, or a property-level Reddit excerpt - checked mechanically here.
 *
 * WHY. The 2026-08-09/11 Direction-A run had only the tags and the recon in
 * front of it, so for each tag with no prose it wrote a sentence to match the
 * TAG. Where the tag was wrong, so was the sentence: "walk-ins are welcome" on an
 * appointment-only bridal shop (d'Anelli), "full planning is her main service
 * tier" for an elopement-only planner (Wild Love), "the onsite spots don't cost
 * anything" with no source at all (Urban Cowboy). The evidence check of that
 * era only asked that a tag quote appear in a recon entry - which those appended
 * sentences then satisfied for the next run, so the loop was closed on itself.
 *
 * What does NOT count as evidence, by construction:
 *   - vendors.filters / filters_meta quotes (the tag is the claim, not its proof)
 *   - the model's own drafted text (the miner used to quote its own entry)
 *   - a bot recon entry (1,301 of them carry the unsourced appends above)
 *   - region- or chain-level research (a Reddit comment on Marriott/Hilton brand
 *     policy is not a fact about one property - plan item 15)
 *   - dossier.md (a compressed derivative, not a source) and region-wide files
 *     like pricing-web-*.txt / launchintel digests (not about one vendor - item 17)
 *
 * A HUMAN recon entry is a primary source for a tag (a couple reporting their
 * own quote) and stays one; that check lives with the callers.
 *
 * This module never decides that a fact is TRUE. It decides only that the quote
 * offered for it exists, verbatim, in a source about this one vendor - and that
 * every number the new text states appears in that evidence. A real quote that
 * does not support the claim still needs the human read of the change list.
 */

import { existsSync, readFileSync, readdirSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { MONEY, bareNumberPrice } from "./lib.mjs";
import { checkProse, toolingTell, priceContradiction } from "./prose-gate.mjs";

export { priceContradiction };
import { mainCheckoutRoot } from "./audit.mjs";

// --- normalization ----------------------------------------------------------

/** Lowercase, decode the entities the harvest leaves in, unify quotes/dashes, collapse space. */
export function normText(s) {
  return String(s ?? "")
    .replace(/&mdash;|&ndash;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&nbsp;|&gt;|&lt;/gi, " ")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Numbers stated in a text, commas dropped: "$1,250-$1,800" -> ["1250","1800"]. */
export function numbersIn(s) {
  return (String(s ?? "").match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) =>
    n.replace(/,/g, "").replace(/\.0+$/, ""),
  );
}

// A quote this short proves nothing ("hair", "yes") - it is in every page.
const MIN_QUOTE_CHARS = 20;
const MIN_QUOTE_WORDS = 4;

// --- the source index -------------------------------------------------------

/**
 * vendor_id -> research dirs, built by scanning every per-vendor research dir
 * (`data/enrichvendors/<run>/research/<slug>/harvest.json`, plus the legacy
 * `data/enrichvenues/<run>/research/` venue harvests) in the MAIN checkout - the
 * data is gitignored, so it exists only there. On a CI runner none of it exists,
 * so the index is empty and every bot-cited write fails "no harvested sources";
 * researchIndex() says so once, loudly, so that reads as an environment fact
 * rather than as a collapse in confirmable tags. Reads just the
 * head of each harvest.json (vendor_id is its first key) to keep the 4,300-file
 * scan to a few seconds.
 */
let INDEX = null;
export function researchIndex(roots = researchRoots()) {
  if (INDEX) return INDEX;
  INDEX = new Map();
  const buf = Buffer.alloc(400);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const run of readdirSync(root)) {
      const rdir = join(root, run, "research");
      if (!existsSync(rdir)) continue;
      for (const slug of readdirSync(rdir)) {
        const h = join(rdir, slug, "harvest.json");
        if (!existsSync(h)) continue;
        const fd = openSync(h, "r");
        const n = readSync(fd, buf, 0, buf.length, 0);
        closeSync(fd);
        const m = buf.toString("utf8", 0, n).match(/"vendor_id"\s*:\s*"([0-9a-f-]{36})"/);
        if (!m) continue;
        if (!INDEX.has(m[1])) INDEX.set(m[1], []);
        INDEX.get(m[1]).push({ run, slug, dir: join(rdir, slug) });
      }
    }
  }
  if (!INDEX.size)
    console.warn(
      `evidence: NO harvested research found under ${roots.join(", ")} - nothing can be confirmed from sources on this machine ` +
        "(expected on CI: data/ is gitignored). Bot-cited writes will all be rejected; human-entry tags are unaffected.",
    );
  return INDEX;
}

export function researchRoots() {
  if (process.env.RECONCILE_RESEARCH_ROOTS) return process.env.RECONCILE_RESEARCH_ROOTS.split(":");
  // enrichvenues holds the original Denver venue harvests from before the rename
  // to enrichvendors. Those venues were re-harvested under enrichvendors since
  // (2,082 of 2,084 bot-entry vendors resolve either way, 2026-10-02), so this is
  // belt and braces for the older page text, not a coverage fix.
  const main = mainCheckoutRoot();
  return [join(main, "data/enrichvendors"), join(main, "data/enrichvenues")];
}

/** Split a reddit-slice.txt into its `--- reddit (...) [basis=X]` blocks. */
export function redditBlocks(text) {
  const out = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^---\s.*?(?:\[basis=([a-z_-]+)\])?\s*$/i);
    if (line.startsWith("--- ") && m) {
      if (cur) out.push(cur);
      cur = { basis: (m[1] || "unknown").toLowerCase(), head: line, lines: [] };
    } else if (cur) cur.lines.push(line);
  }
  if (cur) out.push(cur);
  return out;
}

const SKIP_FILES = new Set(["dossier.md", "harvest.json", "reddit-slice.txt"]);
const SOURCES = new Map();

/**
 * Every harvested source for one vendor: [{id, basis, when, text, norm}].
 * basis is "property" for the vendor's own pages and its own reviews; reddit
 * excerpts carry the basis the launch/enrich research labelled them with
 * (property / region / chain). `extra` adds per-run sources (the daily miner's
 * fetched site text, persisted by daily-build-calls).
 */
export function sourcesFor(vendorId, extra = []) {
  if (!SOURCES.has(vendorId)) {
    const out = [];
    for (const { run, slug, dir } of researchIndex().get(vendorId) ?? []) {
      const tag = `${run}/${slug}`;
      for (const f of readdirSync(dir)) {
        if (SKIP_FILES.has(f) || !/\.txt$/.test(f)) continue;
        out.push({ id: `${tag}/${f}`, basis: "property", text: readFileSync(join(dir, f), "utf8") });
      }
      try {
        const h = JSON.parse(readFileSync(join(dir, "harvest.json"), "utf8"));
        (h.google?.reviews ?? []).forEach((r, i) => {
          if (r?.text) out.push({ id: `${tag}/review-${i}`, basis: "property", when: r.when ?? null, text: r.text });
        });
        (h.pdf_texts ?? []).forEach((t, i) => {
          const text = typeof t === "string" ? t : t?.text;
          if (text) out.push({ id: `${tag}/pdf-${i}`, basis: "property", text });
        });
      } catch {
        // A truncated harvest.json still leaves its page .txt files usable.
      }
      const rs = join(dir, "reddit-slice.txt");
      if (existsSync(rs))
        redditBlocks(readFileSync(rs, "utf8")).forEach((b, i) =>
          out.push({ id: `${tag}/reddit-${i}`, basis: b.basis, text: `${b.head}\n${b.lines.join("\n")}` }),
        );
    }
    for (const s of out) s.norm = normText(s.text);
    SOURCES.set(vendorId, out);
  }
  const extras = extra.map((s) => ({ basis: "property", ...s, norm: normText(s.text) }));
  return [...SOURCES.get(vendorId), ...extras];
}

/** Compact source listing for a model prompt, capped. Non-property blocks are labelled as such. */
export function renderSources(vendorId, maxChars = 12000) {
  const parts = [];
  let used = 0;
  for (const s of sourcesFor(vendorId)) {
    const label =
      s.basis === "property"
        ? `SOURCE ${s.id}${s.when ? ` (review ${s.when})` : ""}`
        : `SOURCE ${s.id} [${s.basis.toUpperCase()}-LEVEL - not about this property; may not support any sentence or tag]`;
    const body = s.text.replace(/\s+/g, " ").trim();
    const room = maxChars - used - label.length;
    if (room < 200) break;
    const piece = body.slice(0, Math.min(room, 3000));
    parts.push(`${label}\n${piece}`);
    used += label.length + piece.length;
  }
  return parts.join("\n\n");
}

// --- the checks -------------------------------------------------------------

/**
 * Brand / chain-level wording. A quote like "Any Marriott or Hilton brand hotel
 * will do room blocks with a signed agreement" set block_type: guaranteed on
 * individual properties (plan item 15), but it reports a BRAND policy and the
 * excerpt itself said it was not confirmed for the property. Used only to REJECT
 * evidence, never to decide a value.
 */
const BRAND_LEVEL = new RegExp(
  [
    /\bchain[- ]level\b|\bbrand[- ]level\b|\bbrand[- ]?wide\b|\bchain[- ]?wide\b/,
    /\b(?:brand|chain|corporate) (?:polic(?:y|ies)|standards?|rules?)\b/,
    /\breported for the (?:brand|chain)\b|\bnot confirmed for (?:this|the) property\b/,
    /\bat the (?:brand|chain) level\b|\bacross (?:the |all )?(?:brand|chain|their properties|locations)\b/,
    /\b(?:any|all|most|every) (?:marriott|hilton|hyatt|ihg|wyndham|best western|radisson|choice|hotel brand|chain)\b/,
    /\b(?:marriott|hilton|hyatt|ihg|wyndham|best western|radisson)(?: or \w+)? (?:brand|branded|family|properties|hotels)\b/,
  ]
    .map((r) => r.source)
    .join("|"),
  "i",
);

export function brandLevel(text) {
  const m = String(text ?? "").match(BRAND_LEVEL);
  return m ? m[0] : null;
}

/**
 * The sentence (or bullet) of `prose` that holds `quote`, case-insensitive, so a
 * "reddit says" or "any Marriott" a few words before the quoted clause still counts.
 * Empty string when the quote is not in the prose.
 */
export function sentenceAround(prose, quote) {
  const flat = String(prose ?? "").replace(/\s+/g, " ");
  const q = String(quote ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const at = flat.toLowerCase().indexOf(q);
  if (!q || at < 0) return "";
  const before = flat.slice(0, at);
  const after = flat.slice(at + q.length);
  const start = Math.max(before.lastIndexOf(". "), before.lastIndexOf(" -")) + 1;
  const end = after.search(/[.!?](?:\s|$)| -\S/);
  return flat.slice(start, at + q.length + (end < 0 ? after.length : end + 1));
}

/**
 * Basis rule for a tag drafted INLINE with its prose (the enrich path: pipeline.mjs
 * status + upload.mjs gateFilters), where the tag quote cites the drafted sentence rather
 * than a harvested source, so verifyEvidence() cannot run. Same rule as the reconcile
 * writers (plan item 15: Marriott/Hilton `block_type: guaranteed` set from a brand-level
 * reddit comment), checked on what the enrich path does have:
 *   - brand/chain wording in the tag quote or in the sentence around it (brandLevel);
 *   - a sentence that leans on reddit when every reddit excerpt on file for this vendor is
 *     region- or chain-level (`[basis=region|chain]` in its reddit-slice.txt): that
 *     excerpt is market context, not a fact about the property.
 * Returns an error string, or null. `redditSlice` is the vendor's reddit-slice.txt text
 * (null when it has none).
 */
const REDDIT_CITE = /\breddit\b|\bsubreddit\b|\br\/\w+|\bthread\b|\bredditor/i;
export function tagBasisProblem(quote, { prose = "", sentence = sentenceAround(prose, quote), redditSlice = null } = {}) {
  const brand = brandLevel(quote) || brandLevel(sentence);
  if (brand) return `brand/chain-level wording ("${brand}") may not set a property tag`;
  if (redditSlice && REDDIT_CITE.test(`${quote} ${sentence}`)) {
    const bases = [...new Set(redditBlocks(redditSlice).map((b) => b.basis))];
    // An unlabelled block (older slices) is not evidence either way, so it never trips this.
    if (bases.length && bases.every((b) => b === "region" || b === "chain"))
      return `rests on reddit, but every reddit excerpt on file for this vendor is ${bases.join("/")}-level (not about this property)`;
  }
  return null;
}

/**
 * Claim shapes the 2026-10-02 audit caught with a REAL quote attached that did
 * not say the thing. A verbatim check passes those: Urban Cowboy's "the onsite
 * spots don't cost anything" cited "available on a first come first serve
 * basis", which is genuine page text and says nothing about price. So a clause
 * making one of these claims must find the claim's own wording in its evidence.
 * Deliberately a short list of observed failures - a backstop that only ever
 * REJECTS, never a judge of what a quote supports.
 */
const STRONG_CLAIMS = [
  {
    label: "costs nothing / free",
    claim: /\b(?:free|no charge|(?:do|does)\s*n[o']?t cost|cost(?:s)? nothing|at no (?:extra |additional )?cost|complimentary|no (?:extra |additional )?fee)\b/i,
    support: /\b(?:free|no charge|no cost|cost nothing|complimentary|no (?:extra |additional )?fee|at no (?:extra |additional )?(?:cost|charge)|without charge)\b/i,
  },
  {
    label: "walk-ins / no appointment",
    claim: /\bwalk[- ]?ins?\b|\bno appointment\b|\bwithout an? appointment\b|\bappointments? (?:are |is )?not (?:needed|required)\b/i,
    support: /\bwalk[- ]?ins?\b|\bno appointment\b|\bwithout an? appointment\b|\bappointments? (?:are |is )?not (?:needed|required)\b/i,
  },
  {
    label: "full planning / full service",
    claim: /\bfull[- ](?:planning|service)\b/i,
    support: /\bfull[- ](?:planning|service)\b/i,
  },
];

export function unsupportedClaims(text, quotes) {
  const ev = quotes.map((q) => normText(q)).join(" | ");
  return STRONG_CLAIMS.filter((c) => c.claim.test(text) && !c.support.test(ev)).map((c) => c.label);
}

/**
 * Verify a list of evidence items [{quote, source}] for one vendor.
 * Returns { ok, errors, verified: [{quote, source, basis}] }.
 *
 *   - each quote must be long enough to mean something, and appear VERBATIM
 *     (after normalization) in a harvested source for THIS vendor;
 *   - a quote found only in region/chain-level research is rejected (item 15);
 *   - a quote carrying brand-level wording is rejected even from a property
 *     source (the slice summaries embed brand quotes under property headers too);
 *   - `numbers`: every number the NEW text states must appear in the evidence,
 *     so a figure cannot be invented or carried over from a tag.
 */
export function verifyEvidence(vendorId, evidence, { numbers = [], extra = [], claimText = "" } = {}) {
  const errors = [];
  const verified = [];
  const skippedOptional = [];
  const list = Array.isArray(evidence) ? evidence : evidence ? [evidence] : [];
  if (!list.length) return { ok: false, errors: ["no source evidence (a verbatim quote from a harvested page or review is required)"], verified };
  const sources = sourcesFor(vendorId, extra);
  if (!sources.length) return { ok: false, errors: ["no harvested sources on file for this vendor - nothing can be confirmed"], verified };

  for (const ev of list) {
    // An optional item (a tag quote offered for checking) that fails is noted,
    // not fatal - but it never counts as verified.
    const fail = (msg) => (ev?.optional ? skippedOptional : errors).push(msg);
    const q = normText(ev?.quote);
    if (q.length < MIN_QUOTE_CHARS || q.split(" ").length < MIN_QUOTE_WORDS) {
      fail(`evidence quote too short to prove anything: "${ev?.quote ?? ""}"`);
      continue;
    }
    const hits = sources.filter((s) => s.norm.includes(q));
    if (!hits.length) {
      fail(`evidence quote is not verbatim in any harvested source for this vendor: "${String(ev.quote).slice(0, 90)}"`);
      continue;
    }
    const prop = hits.filter((s) => s.basis === "property");
    if (!prop.length) {
      fail(
        `evidence is ${[...new Set(hits.map((h) => h.basis))].join("/")}-level research, not about this property: "${String(ev.quote).slice(0, 90)}"`,
      );
      continue;
    }
    const brand = brandLevel(ev.quote);
    if (brand) {
      fail(`evidence reports a brand/chain-level policy ("${brand}"), which may not set a property fact`);
      continue;
    }
    const claimed = ev.source && prop.find((s) => s.id === ev.source);
    verified.push({ quote: ev.quote, source: (claimed ?? prop[0]).id, basis: "property", ...(claimed || !ev.source ? {} : { claimed_source: ev.source }) });
  }

  if (verified.length && numbers.length) {
    const have = new Set(verified.flatMap((v) => numbersIn(v.quote)));
    const missing = [...new Set(numbers)].filter((n) => !have.has(n));
    if (missing.length) errors.push(`number(s) ${missing.join(", ")} stated in the new text appear in none of its evidence quotes`);
  }
  if (verified.length && claimText) {
    const gaps = unsupportedClaims(claimText, verified.map((v) => v.quote));
    if (gaps.length) errors.push(`the text claims "${gaps.join('", "')}" but no evidence quote says so`);
  }
  if (!verified.length && !errors.length)
    errors.push(`no evidence item could be confirmed (${skippedOptional.join("; ")})`);
  return { ok: errors.length === 0 && verified.length > 0, errors, verified };
}

// --- card-level prose checks --------------------------------------------------

// priceContradiction() (a MONEY figure while a field says no price is posted) lives in
// prose-gate.mjs since 2026-10-02, so the enrich gates use the same definition. Imported
// above and re-exported for the reconcile writers that import it from here.

/**
 * Run the shared prose gates over an edit. Rejects anything the edit INTRODUCES
 * - a gate hit in the new text itself, or a card-level violation present after
 * the edit and not before - so a legacy card that already fails a gate (an old
 * empty price_details, say) can still receive a clean fix, but nothing can make
 * a card worse.
 */
export function guardProseEdit(before, after, addedText) {
  const strip = (errs) => errs.filter((e) => !/required|empty notes/.test(e));
  const was = new Set(checkProse(before));
  const errors = checkProse(after).filter((e) => !was.has(e));
  if (addedText) {
    for (const e of strip(checkProse({ notes: addedText, price_text: addedText, price_details: addedText })))
      if (!errors.includes(e)) errors.push(e);
    // Tooling language is the defect class most likely in a reconcile append
    // (it is written by a pass that knows about tags and sources), so it is
    // checked by name with the shared verdict, not only via checkProse.
    const tell = toolingTell(addedText);
    const msg = tell && `${tell.kind} "${tell.match}"`;
    if (msg && !errors.includes(msg)) errors.push(msg);
  }
  const c0 = priceContradiction(before);
  const c1 = priceContradiction(after);
  if (c1 && !c0) errors.push(c1);
  if (addedText && /pric|\$/i.test(addedText) && bareNumberPrice(addedText))
    errors.push(`price stated as a bare number with no $: "${addedText.slice(0, 60)}"`);
  return errors;
}

// --- shared per-write reviews (gate and apply run the SAME checks) ------------

/**
 * How an append joins the existing field. Much of this corpus is bullet-style
 * notes that do not end in a period, and joining with a space produced visible
 * run-ons on the first reconcile run ("...set up and serve The barn sits...").
 *   append is itself a bullet -> its own line
 *   previous ends a sentence  -> same paragraph, space
 *   otherwise (open bullet)   -> its own line
 */
export function joinAppend(current, append) {
  const cur = String(current ?? "").trimEnd();
  if (!cur) return append;
  const joiner = /^\s*-/.test(append) || !/[.!?]$/.test(cur) ? "\n" : " ";
  return `${cur}${joiner}${append}`;
}

const cardOf = (e) => ({ notes: e.notes ?? "", price_text: e.price_text ?? "", price_details: e.price_details ?? "" });

/**
 * Review one prose change to a BOT entry. `card` is the entry as it stands
 * before this change (callers thread it through, so several edits to one entry
 * compound instead of each starting from the export). `change` is either
 *   { kind: "append", field, text, evidence }            (Direction A)
 *   { kind: "replace", field, old, text, evidence }      (corrections / fix_recon)
 * Returns { errors, verified, after }.
 */
export function reviewProseChange({ vendorId, entry, card, change, extra = [] }) {
  const errors = [];
  if (!entry) return { errors: ["entry not in this vendor's export"], verified: [], after: card };
  // Hard line, same as migration 0036: a real person's words are theirs.
  if (!entry.is_bot) return { errors: ["NOT a bot entry - refusing to edit a real person's words"], verified: [], after: card };
  const allowed = change.kind === "append" ? ["notes", "price_details"] : ["notes", "price_text", "price_details"];
  if (!allowed.includes(change.field)) return { errors: [`field "${change.field}" is not editable`], verified: [], after: card };
  const text = String(change.text ?? "").trim();
  if (!text) return { errors: ["empty text"], verified: [], after: card };

  const before = card ?? cardOf(entry);
  let next;
  if (change.kind === "append") next = joinAppend(before[change.field], text);
  else {
    const cur = before[change.field] ?? "";
    if (!change.old || !cur.includes(change.old)) errors.push(`"old" is not a verbatim substring of ${change.field}`);
    else if (cur.indexOf(change.old) !== cur.lastIndexOf(change.old)) errors.push(`"old" occurs more than once - ambiguous target`);
    next = errors.length ? cur : cur.replace(change.old, text);
  }
  const after = { ...before, [change.field]: next };

  errors.push(...guardProseEdit(before, after, text));
  // Every number the change states must come from its evidence, so a figure
  // cannot be lifted from a tag (the Et Voila headline) or invented.
  const ev = verifyEvidence(vendorId, change.evidence, { numbers: numbersIn(text), extra, claimText: text });
  errors.push(...ev.errors);
  return { errors, verified: ev.verified, after };
}

/**
 * Review one tag write that cites a recon entry as its evidence.
 *   - the cited quote must be verbatim in that entry (as before);
 *   - a BOT entry is not proof on its own: 1,301 bot entries carry reconcile
 *     appends written to match a tag, so reading a tag back off one of them
 *     closes the loop on itself. A bot-cited write also needs verified
 *     harvested-source evidence. A HUMAN entry is a primary source and stands.
 *   - brand/chain wording in the quote may not set a property tag (item 15).
 *   - a numeric value must be stated in the quote it rests on.
 */
export function reviewTagWrite({ vendorId, write, entry, extra = [] }) {
  const errors = [];
  if (!entry) return { errors: [`cites entry ${write.entry_id}, which is not this vendor's`], verified: [] };
  const q = normText(write.quote);
  if (!q) return { errors: ["no quote - every tag write must carry its evidence"], verified: [] };
  const hay = normText([entry.notes, entry.price_text, entry.price_details, entry.service_region].join(" "));
  if (!hay.includes(q)) return { errors: [`quote not found in entry ${write.entry_id} - evidence is invented`], verified: [] };
  const brand = brandLevel(write.quote);
  if (brand) errors.push(`quote reports a brand/chain-level policy ("${brand}") - may not set a property tag`);
  const nums = typeof write.value === "number" ? [String(write.value).replace(/\.0+$/, "")] : [];
  if (nums.length && !numbersIn(write.quote).includes(nums[0])) errors.push(`value ${write.value} is not stated in its own quote`);
  let verified = [];
  if (entry.is_bot) {
    const ev = verifyEvidence(vendorId, write.evidence, { numbers: nums, extra, claimText: write.quote });
    if (!ev.ok) errors.push(...ev.errors.map((e) => `cites a BOT entry, so needs source evidence: ${e}`));
    verified = ev.verified;
  }
  return { errors, verified };
}

/**
 * Evidence for a correction. Corrections were built FROM a tag's published
 * quote (price_quote / capacity_quote), and a tag is not proof of itself - but
 * the quote it carries can be checked against the harvested page it claims to
 * come from. So the tag quote is OFFERED as evidence here and verifyEvidence
 * accepts it only if it is verbatim in a source; a model-supplied `evidence`
 * list is offered alongside. Which quote is relevant follows the change: a
 * change that states money is a price fact, otherwise capacity.
 */
export function correctionEvidence(filters, change) {
  const out = [...(Array.isArray(change.evidence) ? change.evidence : [])];
  const f = filters ?? {};
  const isPrice = MONEY.test(change.new ?? "") || /price/.test(change.key ?? "") || /price/.test(change.field ?? "");
  const q = isPrice ? f.price_quote : f.capacity_quote;
  if (q && !out.some((e) => e?.quote === q)) out.push({ quote: q, optional: true });
  return out;
}

/**
 * Site text a daily run fetched for a vendor, persisted by daily-build-calls to
 * `<workdir>/sources/<vendor_id>.json` so the apply can check quotes against
 * what the model was actually shown (it used to exist only inside the call
 * file, so the miner could only be checked against its own output).
 */
export function runSources(workDir, vendorId) {
  const p = join(workDir, "sources", `${vendorId}.json`);
  if (!existsSync(p)) return [];
  try {
    const s = JSON.parse(readFileSync(p, "utf8"));
    return s.text ? [{ id: `site:${s.pages?.[0]?.url ?? "own-site"}`, basis: "property", text: s.text }] : [];
  } catch {
    return [];
  }
}
