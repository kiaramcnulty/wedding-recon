#!/usr/bin/env node
/**
 * Backfill vendors.filters from the measured extraction dataset.
 *
 *   node scripts/backfill-vendor-filters.mjs [--dry] [--limit N]
 *   node scripts/backfill-vendor-filters.mjs --hist-only   (no DB, no creds)
 *
 * Source: data/filter-extraction/vendor-filters.jsonl (2,163 rows, one per
 * vendor). Requires migration 0032. Safe to re-run: it only overwrites rows
 * whose filters_source is null or 'extraction', so a value a human set through
 * the app survives a re-run.
 *
 * It also emits lib/constants/filter-histograms.json, the slider axes. That
 * half is pure derived data from the committed JSONL, so `--hist-only` skips
 * the DB entirely — retuning a slider must not need production credentials.
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
import { VENDOR_FILTERS } from "../lib/constants/vendor-filters.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "data/filter-extraction/vendor-filters.jsonl");
const HIST_OUT = resolve(ROOT, "lib/constants/filter-histograms.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const HIST_ONLY = args.includes("--hist-only");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Number(args[i + 1]) : Infinity;
})();

// --- env -------------------------------------------------------------------
// Deferred: --hist-only reads only the committed JSONL, so it must work in a
// checkout with no .env.local at all.
function connect() {
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
  return createClient(url, key, { auth: { persistSession: false } });
}

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
/**
 * Slider bin edges. Two stages, because the two failure modes pull opposite
 * ways and neither binning scheme survives both on its own:
 *
 *   1. QUANTILE. Equal-count bins, so the slider shows real density rather than
 *      a uniform axis nobody occupies. Every wedding price distribution is
 *      long-tailed, and uniform bins put six of seven notches in empty space.
 *
 *   2. SPLIT the bins quantile made too WIDE. Equal count is equal *share of
 *      vendors*, which says nothing about how far one notch moves the number.
 *      Venue fee came out 4900-7500 and then 7500-48674 in a single step: 48
 *      venues, 16% of the corpus, behind one notch a couple could not aim
 *      inside (reported by Kiara, 2026-08-06). The tail is where it bites,
 *      because that is where density collapses, but the rule is stated on the
 *      bin rather than on the tail so it holds for any distribution.
 *
 * A bin is too wide when hi/lo exceeds MAX_RATIO — a ratio, not a width, since
 * $500 is a big step at the bottom of a price range and noise at the top. Wide
 * bins are re-cut on the NICE ladder so edges read as money a person would say
 * ($10k, $15k), never as a quantile artifact ($11,117).
 *
 * What stops it shredding a sparse tail into empty notches is the density
 * floor: no sub-bin may hold fewer than `floor` values, INCLUDING the remainder
 * left above the last cut. So a cut is taken only where enough vendors sit on
 * both sides of it, and the top notch stays an honest "and up". Where the data
 * cannot support a finer axis nothing happens — 28 priced DJs keep their one
 * wide $250-900 opening bin, which is the truthful rendering of 28 data points.
 *
 * Widest-first, so a fixed budget of extra notches buys down the worst jump
 * first. MAX_BINS is a backstop against a pathological corpus, not a tuning
 * knob: at 2,163 vendors nothing reaches it except venue capacity, which is
 * density-saturated at 12 anyway.
 */
const MAX_RATIO = 3;
const MIN_SHARE = 0.03;
const MIN_N = 3;
const MAX_BINS = 12;

/** Round numbers a person would say, over every decade. */
const NICE_MANTISSA = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5];
function niceBetween(lo, hi) {
  const out = [];
  for (let k = -3; k <= 9; k++) {
    for (const m of NICE_MANTISSA) {
      const value = Number((m * 10 ** k).toPrecision(12));
      if (value > lo && value < hi) out.push(value);
    }
  }
  return out.sort((a, b) => a - b);
}

function bins(values, count = 7) {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length < count) return null;
  const quantile = [];
  for (let i = 0; i <= count; i++) quantile.push(v[Math.min(v.length - 1, Math.floor((i * v.length) / count))]);
  const uniq = [...new Set(quantile)];
  if (uniq.length < 3) return null;

  const between = (lo, hi) => v.filter((x) => x >= lo && x < hi).length;
  const floor = Math.max(MIN_N, Math.ceil(v.length * MIN_SHARE));

  // A bin whose lo is 0 has no meaningful ratio and is left alone.
  const wide = uniq
    .slice(0, -1)
    .map((lo, i) => ({ lo, hi: uniq[i + 1] }))
    .filter((b) => b.lo > 0 && b.hi / b.lo > MAX_RATIO)
    .sort((a, b) => b.hi / b.lo - a.hi / a.lo);

  const extra = new Set();
  let budget = MAX_BINS - (uniq.length - 1);
  for (const b of wide) {
    if (budget <= 0) break;
    let cur = b.lo;
    for (const cut of niceBetween(b.lo, b.hi)) {
      if (budget <= 0) break;
      if (between(cur, cut) < floor) continue; // too thin below — take a wider step
      if (between(cut, b.hi) < floor) break; // too thin above — leave the rest as one
      extra.add(cut);
      budget--;
      cur = cut;
    }
  }

  const edges = [...new Set([...uniq, ...extra])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i], hi = edges[i + 1];
    const last = i === edges.length - 2;
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

const HIST_KEYS = ["price_min", "capacity_max", "minimum_spend", "bride_price_min", "party_price_min", "turnaround_weeks"];

/**
 * The number a row should be binned under — the generator's half of the sheet's
 * `priceForContext`, and it has to agree with it. A filter that declares a
 * `basis` only compares against quotes in that basis: an off-basis one is
 * converted when `basisScale` can (a per-person venue at the stated guest
 * count) and dropped when it cannot (a per-night hotel rate on a venue row is
 * not a venue fee at any guest count).
 *
 * Edges and bars must come from ONE value set. Binning raw put 13 per-person
 * venues quoting $25-$150 into the $0-499 bar while the matcher was reading
 * them as $2.5k-$15k, and let a single $22,000 room rate pad the top bin.
 */
function valueFor(f, key, def) {
  const n = f[key];
  if (typeof n !== "number") return undefined;
  if (!def?.basis) return n;
  const basis = f.price_basis;
  if (typeof basis !== "string" || basis === def.basis) return n;
  const factor = def.basisScale?.[basis];
  return factor === undefined ? undefined : n * factor;
}

const hist = {};
for (const [t, list] of Object.entries(byType)) {
  const h = {};
  const defs = VENDOR_FILTERS[t] ?? [];
  for (const key of HIST_KEYS) {
    const def = defs.find((d) => d.kind === "range" && (d.lo ?? d.key) === key);
    const b = bins(list.map((f) => valueFor(f, key, def)).filter((n) => n !== undefined));
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

// The axes a couple actually drags, printed so a retune can be read rather
// than diffed out of the JSON. Notches still wider than MAX_RATIO are called
// out: every one of them is data-limited (the density floor refused the cut),
// so the line is a read on where the corpus is thin, not a defect list.
console.log("\nslider axes");
for (const [t, h] of Object.entries(hist)) {
  for (const [key, b] of Object.entries(h)) {
    const coarse = b.bins.filter((x) => x.lo > 0 && x.hi / x.lo > MAX_RATIO);
    console.log(
      `  ${t}.${key}`.padEnd(30) +
        `${b.bins.length} bins\n` +
        `    ${b.bins.map((x) => `${x.lo}-${x.hi}:${x.n}`).join("  ")}` +
        (coarse.length
          ? `\n    coarse (too few vendors to cut): ${coarse
              .map((x) => `${x.lo}-${x.hi} (${(x.hi / x.lo).toFixed(1)}x, n=${x.n})`)
              .join(", ")}`
          : ""),
    );
  }
}

if (HIST_ONLY) {
  console.log("\n--hist-only: no vendor rows written.");
  process.exit(0);
}

const db = connect();
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
