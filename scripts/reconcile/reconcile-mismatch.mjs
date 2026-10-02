#!/usr/bin/env node
/**
 * Reconcile the 104 vendors whose filters carry a clean published price but
 * whose recon shows no figure - the "card says no quote while sorting as
 * priced" set (Kiara, 2026-08-09). Adjudicated by hand, per vendor, not by a
 * batch sweep (which got these wrong by over-siding with the recon bot).
 *
 *   node scripts/reconcile/reconcile-mismatch.mjs            (dry run)
 *   node scripts/reconcile/reconcile-mismatch.mjs --apply
 *
 * Two verdicts:
 *   REMOVE - the tagged number is retail per-item, a la carte, or unrelated
 *     (individual bouquet products, a coworking hourly rate, sandwich prices).
 *     Delete the price cluster from filters. The recon's "no quote" is then
 *     CORRECT. Ids in data/reconcile/remove-ids.json.
 *   FIX    - the number is a real wedding-service price the recon bot missed.
 *     Rewrite one bot entry's price_text to state the published figure, so the
 *     card stops showing "no quote". The figure IS the published fact, not
 *     invention; it is generated from the vendor's own min/max/kind/basis.
 */

import { join } from "node:path";
import { serviceClient, ROOT, has } from "./lib.mjs";
import { readFileSync } from "node:fs";

// --apply DISABLED (2026-10-02, docs/bot-recon-quality-plan.md item 1). These
// one-off 2026-08-09 adjudications rewrote a bot entry's price_text from the
// TAG's min/max ("Runs about $65 to $85 per person.") without touching the
// price_details or notes beside it. That is how the Et Voila card came to state
// a figure in its headline while its details said the site "has no rate sheet"
// and its notes said it "doesn't post any actual pricing" - the MONEY + no-price
// contradiction. They also wrote no pre-write snapshot (remaining-backup.json
// was written AFTER the updates). Their inputs are a finished run, so there is
// nothing left for them to do; any further price_text fix goes through
// apply-corrections.mjs, which requires source evidence, runs the shared prose
// gates and the contradiction check, and snapshots first. Dry run still works.
if (has("apply")) {
  console.error(
    "REFUSING --apply: this one-off writer rewrote price_text from tags with no source and no " +
      "snapshot (the Et Voila contradiction). Use apply-corrections.mjs. See plan item 1.",
  );
  process.exit(1);
}

const APPLY = has("apply");
const db = serviceClient();
const data = JSON.parse(readFileSync(join(ROOT, "data/reconcile/mismatch-104.json"), "utf8"));
const removeIds = new Set(JSON.parse(readFileSync(join(ROOT, "data/reconcile/remove-ids.json"), "utf8")));

const PRICE_KEYS = ["price_min", "price_max", "price_basis", "price_kind", "price_confidence", "price_quote", "price_tiers"];

const money = (n) => "$" + (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(2));

// One plain line stating the published price, shaped by basis and kind. Not
// invention - the numbers are the vendor's own published figures.
function priceLine(type, p) {
  const suffix = { per_person: " per person", per_hour: " per hour", per_night: " per night" }[p.basis] || "";
  if (type === "dress") {
    return p.kind === "range" && p.max != null
      ? `Gowns range from ${money(p.min)} to ${money(p.max)}.`
      : `Gowns start at ${money(p.min)}.`;
  }
  // starting_at first: it is a floor, so it must read "starts around" even when
  // no max was extracted - "around" would understate it as the typical price.
  if (p.kind === "starting_at") return `Starts around ${money(p.min)}${suffix}.`;
  if (p.kind === "single_figure" || p.max == null || p.max === p.min) return `Around ${money(p.min)}${suffix}.`;
  return `Runs about ${money(p.min)} to ${money(p.max)}${suffix}.`;
}

let removed = 0, fixed = 0, skipped = 0;

for (const v of data) {
  if (removeIds.has(v.id)) {
    // REMOVE: strip the price cluster; leave the recon prose (its "no quote" is
    // now accurate).
    const { data: live, error } = await db.from("vendors").select("filters,filters_meta,filters_source").eq("id", v.id).single();
    if (error) { console.error(`  ${v.name}: ${error.message}`); continue; }
    if (live.filters_meta?.price_min?.source === "manual") { console.log(`  SKIP ${v.name}: manual`); skipped++; continue; }
    const filters = { ...live.filters }, meta = { ...(live.filters_meta || {}) };
    for (const k of PRICE_KEYS) { delete filters[k]; delete meta[k]; }
    console.log(`  REMOVE ${v.name} [${v.type}]  (was ${v.price.quote.slice(0, 45)})`);
    if (APPLY) {
      const { error: e2 } = await db.from("vendors").update({ filters, filters_meta: meta, filters_source: live.filters_source === "manual" ? "manual" : "recon", filters_updated_at: new Date().toISOString() }).eq("id", v.id);
      if (e2) { console.error(`    ${e2.message}`); continue; }
    }
    removed++;
  } else {
    // FIX: rewrite one bot entry's price_text to show the published price.
    const bot = v.entries.find((e) => e.is_bot);
    if (!bot) { console.log(`  SKIP ${v.name}: no bot entry`); skipped++; continue; }
    const line = priceLine(v.type, v.price);
    console.log(`  FIX ${v.name} [${v.type}]: "${line}"`);
    if (APPLY) {
      const { error } = await db.from("recon_entries").update({ price_text: line, updated_at: new Date().toISOString() }).eq("id", bot.id);
      if (error) { console.error(`    ${error.message}`); continue; }
    }
    fixed++;
  }
}

console.log(["", APPLY ? "APPLIED" : "DRY RUN - nothing written", `  price tags removed: ${removed}`, `  price_text fixed:   ${fixed}`, `  skipped: ${skipped}`].join("\n"));
