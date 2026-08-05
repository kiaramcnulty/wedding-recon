#!/usr/bin/env node
/**
 * Backfill vendors.filters from the measured extraction dataset.
 *
 *   node scripts/backfill-vendor-filters.mjs [--dry] [--limit N]
 *
 * Source: data/filter-extraction/vendor-filters.jsonl (2,163 rows, one per
 * vendor). Requires migration 0032. Safe to re-run: it only overwrites rows
 * whose filters_source is null or 'extraction', so a value a human set through
 * the app survives a re-run.
 *
 * Normalization happens here rather than in the UI because the raw extraction
 * is inconsistent in three ways that would otherwise reach every consumer:
 *   1. block_type is an array on 151 rows and a bare string on 8.
 *   2. Season vocabulary drifted across calls: peak/high mean the same thing,
 *      as do low/off, and mid is the shoulder season.
 *   3. day_type 'weekend' overlaps friday/saturday/sunday, so a tier lookup
 *      would need to know that; expanding it here keeps the SQL simple.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "data/filter-extraction/vendor-filters.jsonl");
const HIST_OUT = resolve(ROOT, "lib/constants/filter-histograms.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Number(args[i + 1]) : Infinity;
})();

// --- env -------------------------------------------------------------------
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// --- normalization ---------------------------------------------------------
const SEASON = { peak: "peak", high: "peak", mid: "shoulder", low: "off", off: "off" };
const DAY = { weekday: ["weekday"], friday: ["friday"], saturday: ["saturday"], sunday: ["sunday"], weekend: ["friday", "saturday", "sunday"] };

/** Keys that are metadata about the row, not filterable attributes. */
const SKIP = new Set(["vendor_id", "name", "vendor_type", "city", "_note"]);

/** Stored as arrays even when the extractor emitted a bare string. */
const ARRAY_KEYS = new Set([
  "bar_service", "block_type", "catering_policy", "ceremony_location", "cuisine",
  "dietary", "engagement_model", "ensemble", "genre", "instruments", "parking",
  "pricing_model", "production", "service_style", "service_tier", "services",
  "setting", "style", "work_mode",
]);

function normalizeTiers(tiers) {
  if (!Array.isArray(tiers)) return undefined;
  const out = [];
  for (const t of tiers) {
    const min = typeof t?.min === "number" ? t.min : null;
    const max = typeof t?.max === "number" ? t.max : null;
    // A tier carrying neither number describes nothing. 1 of 637 rows.
    if (min === null && max === null) continue;
    const season = t?.season ? (SEASON[t.season] ?? null) : null;
    const days = t?.day_type ? (DAY[t.day_type] ?? [t.day_type]) : [null];
    for (const day_type of days) out.push({ season, day_type, min, max });
  }
  return out.length ? out : undefined;
}

function normalize(row) {
  const f = {};
  for (const [k, v] of Object.entries(row)) {
    if (SKIP.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (k === "price_tiers") {
      const t = normalizeTiers(v);
      if (t) f[k] = t;
      continue;
    }
    if (ARRAY_KEYS.has(k)) {
      const arr = (Array.isArray(v) ? v : [v]).filter(Boolean);
      if (arr.length) f[k] = arr;
      continue;
    }
    f[k] = v;
  }
  return Object.keys(f).length ? f : null;
}

// --- histograms ------------------------------------------------------------
/** Quantile-ish bins over observed values, so the slider shows real density
 *  rather than a uniform axis nobody occupies. */
function bins(values, count = 7) {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length < count) return null;
  const edges = [];
  for (let i = 0; i <= count; i++) edges.push(v[Math.min(v.length - 1, Math.floor((i * v.length) / count))]);
  const uniq = [...new Set(edges)];
  if (uniq.length < 3) return null;
  const out = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const lo = uniq[i], hi = uniq[i + 1];
    const last = i === uniq.length - 2;
    out.push({ lo, hi, n: v.filter((x) => x >= lo && (last ? x <= hi : x < hi)).length });
  }
  return { min: v[0], max: v[v.length - 1], median: v[Math.floor(v.length / 2)], bins: out };
}

// --- run -------------------------------------------------------------------
const rows = readFileSync(SRC, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const byType = {};
const payload = [];
for (const r of rows) {
  const f = normalize(r);
  (byType[r.vendor_type] ||= []).push(f || {});
  if (f) payload.push({ id: r.vendor_id, filters: f });
}

const hist = {};
for (const [t, list] of Object.entries(byType)) {
  const h = {};
  for (const key of ["price_min", "capacity_max", "minimum_spend", "bride_price_min", "party_price_min", "turnaround_weeks"]) {
    const b = bins(list.map((f) => f[key]).filter((n) => typeof n === "number"));
    if (b) h[key] = b;
  }
  if (Object.keys(h).length) hist[t] = h;
}

console.log(`${rows.length} rows read, ${payload.length} carry at least one attribute`);
for (const [t, list] of Object.entries(byType)) {
  const withData = list.filter((f) => Object.keys(f).length).length;
  console.log(`  ${t.padEnd(9)} ${String(withData).padStart(4)}/${String(list.length).padEnd(4)} ${Math.round((100 * withData) / list.length)}%`);
}

if (DRY) {
  console.log("\n--dry: nothing written. Sample:");
  console.log(JSON.stringify(payload.slice(0, 2), null, 2));
  process.exit(0);
}

writeFileSync(HIST_OUT, JSON.stringify(hist, null, 1) + "\n");
console.log(`\nwrote ${HIST_OUT}`);

const todo = payload.slice(0, LIMIT);
let ok = 0, failed = 0, skipped = 0;
const POOL = 12;
let cursor = 0;
await Promise.all(
  Array.from({ length: POOL }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= todo.length) return;
      const { id, filters } = todo[i];
      // Only overwrite extraction-sourced rows, so a human edit survives.
      const { data, error } = await db
        .from("vendors")
        .update({ filters, filters_source: "extraction", filters_updated_at: new Date().toISOString() })
        .eq("id", id)
        .or("filters_source.is.null,filters_source.eq.extraction")
        .select("id");
      if (error) { failed++; if (failed < 5) console.error(`  ${id}: ${error.message}`); }
      else if (!data?.length) skipped++;
      else { ok++; if (ok % 250 === 0) console.log(`  ${ok}/${todo.length}`); }
    }
  }),
);
console.log(`\ndone: ${ok} updated, ${skipped} skipped (human-set or missing), ${failed} failed`);
