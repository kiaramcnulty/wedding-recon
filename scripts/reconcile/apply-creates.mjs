#!/usr/bin/env node
/**
 * Insert the thin drafted entries for the tag-only vendors.
 *
 *   node scripts/reconcile/apply-creates.mjs             (dry run)
 *   node scripts/reconcile/apply-creates.mjs --apply
 *
 * Reads  data/reconcile/creates/results.jsonl  (drafts: vendor_id, notes, price_text)
 *        data/reconcile/creates-targets.json    (vendors + bot roster)
 * INSERTS one recon_entry per vendor under a bot account.
 *
 * These are CREATES, not edits - the only inserts in the system. Guards:
 *   - a distinct bot per vendor, spread across the roster, so the corpus does
 *     not read as one author. The 0028 unique index (vendor_id, author_id) is
 *     satisfied trivially since these vendors have no entries.
 *   - refuses to insert if the vendor somehow already has an active entry now
 *     (a concurrent create), so a re-run cannot double-insert.
 *   - prose gates, same as every other write.
 *   - recon_type online (drafted from public facts, no visit), collected month a
 *     synthetic month in 2026 capped at the current month, service_region null
 *     (there is no recon to derive an area from, so none is claimed).
 * Dry run by default; resumable via applied.jsonl.
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, serviceClient, readJsonl, arg, has, bareNumberPrice } from "./lib.mjs";

const APPLY = has("apply");
const db = serviceClient();
const CREATES = resolve(ROOT, "data/reconcile/creates");

const drafts = readJsonl(resolve(CREATES, "results.jsonl"));
const { targets, bots } = JSON.parse(readFileSync(resolve(ROOT, "data/reconcile/creates-targets.json"), "utf8"));
const vById = new Map(targets.map((v) => [v.id, v]));

const BANNED = /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;
const PROCESS = /\b(crawl\w*|scrape\w*|fetch\w*|dossier|harvest\w*|parse\w*|garbled text|boilerplate|batch\w*|enrich\w*|seeded|roster|pipeline|dataset|databases?|bots?|launchintel|digest\w*)\b/i;
const EMDASH = /[—–]/;

const logPath = resolve(CREATES, "applied.jsonl");
const done = new Set(
  existsSync(logPath) ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).vendor_id) : [],
);

const NOW = new Date();
// Distinct bot per vendor: index the roster by a stable hash of the vendor id,
// so the same vendor always maps to the same bot and the load spreads evenly.
function botFor(id) {
  const h = parseInt(createHash("sha256").update(id).digest("hex").slice(0, 8), 16);
  return bots[h % bots.length];
}
function collectedMonth(id) {
  const h = parseInt(createHash("sha256").update(id + "m").digest("hex").slice(0, 8), 16);
  return (h % (NOW.getMonth() + 1)) + 1;
}
const clean = (s) => (s || "").replace(/\\{1,2}n/g, " ").replace(/\s+/g, " ").trim();

let inserted = 0, skipped = 0, gated = 0;
for (const d of drafts) {
  if (done.has(d.vendor_id)) continue;
  const v = vById.get(d.vendor_id);
  if (!v) { console.error(`  unknown vendor ${d.vendor_id}`); continue; }

  const notes = clean(d.notes);
  const priceText = clean(d.price_text);
  const bad = notes.match(BANNED) || notes.match(PROCESS) || priceText.match(BANNED) || priceText.match(PROCESS);
  if (bad || EMDASH.test(notes) || EMDASH.test(priceText) || !notes) {
    console.error(`  GATE ${v.name}: ${bad ? `"${bad[0]}"` : EMDASH.test(notes + priceText) ? "em dash" : "empty notes"}`);
    gated++;
    continue;
  }
  // A price_text stating a bare number sorts as unpriced and reads as a field
  // dump. Refuse it rather than insert it - re-draft under the $-figure contract.
  if (bareNumberPrice(priceText)) {
    console.error(`  GATE ${v.name}: price_text is a bare number, needs a $ figure -> "${priceText}"`);
    gated++;
    continue;
  }

  // Do not insert if an entry now exists (concurrent create / re-run safety).
  const { count } = await db.from("recon_entries").select("*", { count: "exact", head: true }).eq("vendor_id", d.vendor_id).eq("status", "active");
  if (count > 0) { console.log(`  SKIP ${v.name}: already has an entry`); skipped++; continue; }

  const bot = botFor(d.vendor_id);
  const row = {
    vendor_id: d.vendor_id,
    author_id: bot.id,
    recon_type: "online",
    notes,
    price_text: priceText || null,
    service_region: null,
    recon_collected_month: collectedMonth(d.vendor_id),
    recon_collected_year: NOW.getFullYear(),
    status: "active",
  };

  if (!APPLY) {
    console.log(`  ${v.name} [${v.vendor_type}] by ${bot.username}\n    notes: ${notes}\n    price: ${priceText}`);
  } else {
    const { error } = await db.from("recon_entries").insert(row);
    if (error) { console.error(`  INSERT ${v.name}: ${error.message}`); continue; }
    appendFileSync(logPath, JSON.stringify({ vendor_id: d.vendor_id }) + "\n");
  }
  inserted++;
}

console.log([
  "", APPLY ? "APPLIED" : "DRY RUN - nothing written",
  `  entries inserted: ${inserted}`,
  `  skipped (already had one): ${skipped}`,
  `  gated: ${gated}`,
  APPLY ? "" : "\nRe-run with --apply to insert.",
].join("\n"));
