#!/usr/bin/env node
/**
 * Adjudicate the 139 remaining contradiction verdicts by hand (Kiara,
 * 2026-08-09), not by trusting the batch model - which systematically
 * over-removed real prices, siding with the recon bot's "no pricing found" over
 * the extraction's actual published quote.
 *
 *   node scripts/reconcile/reconcile-remaining.mjs            (dry run)
 *   node scripts/reconcile/reconcile-remaining.mjs --apply
 *
 * REMOVE (below): genuine wrong tags - travel fees tagged as a bride price,
 * album/engagement add-ons tagged as included, a plant nursery's ceremony
 * location, individual bouquet retail, an orphaned setting on a hotel row.
 * Everything else with a real published price gets its price_text set to state
 * that price, so the card stops showing "no quote" while sorting as priced.
 * Backup in remaining-backup.json.
 */

import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { serviceClient, ROOT, has } from "./lib.mjs";

const APPLY = has("apply");
const db = serviceClient();
const J = (p) => readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const remaining = JSON.parse(readFileSync(join(ROOT, "data/reconcile/co-adj/remaining.json"), "utf8"));
const vendors = new Map(J(join(ROOT, "data/reconcile/co-adj/vendors.jsonl")).map((x) => [x.id, x]));

// Wrong tags to delete, by vendor name substring -> key or cluster prefix.
// A prefix ending in "price" expands to all its _min/_max/_quote/_kind/_confidence keys.
const REMOVE = {
  "Angela Gayle": ["bride_price"],           // $400 = travel fee
  "Caroline Lalive": ["bride_price"],        // $600 = travel fee
  "Meghi": ["bride_price"],                  // salon color menu, not bridal
  "Bridal by B": ["bride_price", "price_quote"], // $850 wrong; real is $210-350
  "Gretchen Troop": ["includes_engagement"], // add-on
  "Lyndsey Leach": ["includes_album"],       // add-on (keeps its real price)
  "Real Life Photographs": ["includes_album"],
  "JMGant": ["includes_album"],
  "Kelly Miranda": ["includes_album", "includes_engagement"],
  "Karlatina": ["airbrush"],                 // no makeup offered
  "Luna Flowers": ["price"],                 // individual bouquet retail
  "Dolce Event Center": ["catering_policy"], // in-house network, not outside_allowed
  "Holiday Inn Estes Park": ["setting"],     // orphan venue attr on a hotel row
  "Alpine Gardens": ["ceremony_location"],   // plant nursery, not an event space
  "Dream Catcher": ["pricing_model"],        // misclassified
  "Deshebrado": ["bar_service"],             // assists a separate bartender
  "Blooming Haus": ["style", "offers_rentals", "delivers_installs", "engagement_model"], // no wedding info
};

const money = (n) => "$" + (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(2));

function priceLine(vt, f) {
  // Beauty leads with the bride hair-and-makeup price; everyone else with the package price.
  const mn = vt === "beauty" ? f.bride_price_min : f.price_min;
  const mx = vt === "beauty" ? f.bride_price_max : f.price_max;
  if (mn == null) return null;
  const lead = vt === "beauty" ? "Bride hair and makeup" : null;
  const suffix = { per_person: " per person", per_hour: " per hour", per_night: " per night" }[f.price_basis] || "";
  let body;
  if (mx != null && mx !== mn) body = `${vt === "beauty" ? "runs about" : "Runs about"} ${money(mn)} to ${money(mx)}${suffix}`;
  else if (f.price_kind === "starting_at") body = `${vt === "beauty" ? "starts around" : "Starts around"} ${money(mn)}${suffix}`;
  else body = `${vt === "beauty" ? "around" : "Around"} ${money(mn)}${suffix}`;
  return lead ? `${lead} ${body}.` : `${body}.`;
}

function expand(keys, filters) {
  const out = new Set();
  for (const k of keys) {
    if (k.endsWith("price")) for (const fk of Object.keys(filters)) { if (fk.startsWith(k)) out.add(fk); }
    else out.add(k);
  }
  return [...out];
}

const targetIds = [...new Set(remaining.map((r) => r.vendor_id))];
const backup = [];
let removed = 0, fixedPrice = 0, fixedCap = 0, skipped = 0;

for (const id of targetIds) {
  const vd = vendors.get(id);
  const f = vd.filters;
  const nameKey = Object.keys(REMOVE).find((n) => vd.name.includes(n));

  // Snapshot before touching.
  const { data: live } = await db.from("vendors").select("filters,filters_meta,filters_source").eq("id", id).single();
  const bot = vd.entries.find((e) => e.is_bot);
  const { data: liveEnt } = bot ? await db.from("recon_entries").select("id,price_text").eq("id", bot.id).single() : { data: null };
  backup.push({ id, filters: live.filters, filters_meta: live.filters_meta, filters_source: live.filters_source, entry: liveEnt });

  // 1. Remove wrong tags for this vendor, if any.
  let filters = { ...live.filters }, meta = { ...(live.filters_meta || {}) };
  if (nameKey) {
    const keys = expand(REMOVE[nameKey], filters);
    for (const k of keys) { delete filters[k]; delete meta[k]; }
    console.log(`REMOVE ${vd.name.slice(0, 34).padEnd(34)} [${vd.vendor_type}] -> ${keys.join(", ")}`);
    if (APPLY) await db.from("vendors").update({ filters, filters_meta: meta, filters_source: live.filters_source === "manual" ? "manual" : "recon", filters_updated_at: new Date().toISOString() }).eq("id", id);
    removed++;
  }

  // 2. Capacity fix_recon: apply the model's specific prose edit.
  const capFix = remaining.find((r) => r.vendor_id === id && r.verdict === "fix_recon" && r.key === "capacity_max");
  if (capFix && liveEnt && capFix.old && (liveEnt.price_text ?? "") !== capFix.new) {
    // capacity edits target notes, not price_text - fetch and patch notes
    const { data: full } = await db.from("recon_entries").select("notes").eq("id", bot.id).single();
    if ((full.notes || "").includes(capFix.old)) {
      console.log(`FIX-CAP ${vd.name.slice(0, 30)} : ${capFix.new.slice(0, 60)}`);
      if (APPLY) await db.from("recon_entries").update({ notes: full.notes.replace(capFix.old, capFix.new), updated_at: new Date().toISOString() }).eq("id", bot.id);
      fixedCap++;
    }
  }

  // 3. Show the real price, unless we just removed the price cluster or there is none.
  const stillPriced = (vd.vendor_type === "beauty" ? filters.bride_price_min : filters.price_min) != null;
  const line = stillPriced ? priceLine(vd.vendor_type, filters) : null;
  if (line && bot) {
    console.log(`FIX    ${vd.name.slice(0, 34).padEnd(34)} [${vd.vendor_type}] : "${line}"`);
    if (APPLY) await db.from("recon_entries").update({ price_text: line, updated_at: new Date().toISOString() }).eq("id", bot.id);
    fixedPrice++;
  } else if (!nameKey && !capFix) {
    skipped++;
  }
}

writeFileSync(join(ROOT, "data/reconcile/remaining-backup.json"), JSON.stringify(backup));
console.log(["", APPLY ? "APPLIED" : "DRY RUN", `  removed tags on: ${removed} vendors`, `  price_text fixed: ${fixedPrice}`, `  capacity fixed: ${fixedCap}`, `  skipped: ${skipped}`].join("\n"));
