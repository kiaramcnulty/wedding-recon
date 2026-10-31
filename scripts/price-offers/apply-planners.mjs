#!/usr/bin/env node
/**
 * Write REVIEWED planner price offers to `vendors.filters.price_offers`.
 *
 *   node scripts/price-offers/apply-planners.mjs            # dry run (default)
 *   node scripts/price-offers/apply-planners.mjs --apply    # write
 *
 * Reads `data/price-offers/planner/review.csv` (from verify-planners.mjs) and
 * takes only rows whose `approve` column is exactly "yes". Per vendor it:
 *   - replaces the `price_offers` key only; every other filter is untouched;
 *   - records `filters_meta.price_offers` provenance;
 *   - lifts `filters_source` from extraction/null to "recon", so a re-run of
 *     scripts/backfill-vendor-filters.mjs (which replaces `filters` wholesale on
 *     extraction rows) cannot erase the reviewed offers;
 *   - skips `filters_source = "manual"` rows and lists them, so a human edit is
 *     never overwritten.
 * Idempotent: re-running writes the same offers. Needs NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY (env or .env.local).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
const REVIEW = resolve(ROOT, "data/price-offers/planner/review.csv");

const envFile = resolve(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, embedded newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const num = (s) => (s === "" ? undefined : Number(s));
const byVendor = new Map();
for (const r of parseCsv(readFileSync(REVIEW, "utf8"))) {
  if (r.approve !== "yes") continue;
  const offer = {
    scope: r.scope,
    ...(num(r.price_min) !== undefined && { price_min: num(r.price_min) }),
    ...(num(r.price_max) !== undefined && { price_max: num(r.price_max) }),
    price_kind: r.kind,
    basis: r.basis,
    ...(num(r.percent) !== undefined && { percent: num(r.percent) }),
    ...(r.label_quote && { label_quote: r.label_quote }),
    quote: r.quote,
    source: r.source,
    ...(r.as_of && { as_of: r.as_of }),
    confidence: r.confidence,
  };
  const list = byVendor.get(r.vendor_id) ?? { name: r.name, offers: [] };
  list.offers.push(offer);
  byVendor.set(r.vendor_id, list);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let written = 0, unchanged = 0, manual = 0, missing = 0;
for (const [id, { name, offers }] of byVendor) {
  const { data: live, error } = await db.from("vendors").select("filters, filters_meta, filters_source, vendor_type").eq("id", id).single();
  if (error || !live) { console.log(`  MISSING ${name} (${id})`); missing++; continue; }
  if (live.vendor_type !== "planner") { console.log(`  SKIP ${name}: now typed ${live.vendor_type}`); missing++; continue; }
  if (live.filters_source === "manual") { console.log(`  SKIP ${name}: filters_source=manual, review by hand`); manual++; continue; }
  const before = JSON.stringify(live.filters?.price_offers ?? null);
  if (before === JSON.stringify(offers)) { unchanged++; continue; }
  const stamp = new Date().toISOString();
  const filters = { ...(live.filters ?? {}), price_offers: offers };
  const meta = { ...(live.filters_meta ?? {}), price_offers: { source: "review", updated_at: stamp } };
  const source = live.filters_source == null || live.filters_source === "extraction" ? "recon" : live.filters_source;
  console.log(`  ${APPLY ? "WRITE" : "would write"} ${name}: ${offers.map((o) => `${o.scope} ${o.price_min ?? ""}${o.price_max ? `-${o.price_max}` : ""}${o.percent ? ` ${o.percent}%` : ""}`).join(", ")}`);
  if (APPLY) {
    const { error: e2 } = await db.from("vendors").update({ filters, filters_meta: meta, filters_source: source, filters_updated_at: stamp }).eq("id", id);
    if (e2) { console.error(`  FAILED ${name}: ${e2.message}`); continue; }
  }
  written++;
}
console.log(`\n${APPLY ? "written" : "would write"}: ${written}; unchanged: ${unchanged}; manual (skipped): ${manual}; missing/retyped: ${missing}`);
if (!APPLY) console.log("Dry run. Re-run with --apply to write.");
