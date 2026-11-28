#!/usr/bin/env node
/**
 * Write each DJ's `specialty` filter from the 2026-11-28 research pass.
 *
 *   node scripts/backfill-dj-specialty.mjs                    # dry run (default)
 *   node scripts/backfill-dj-specialty.mjs --apply            # write
 *   node scripts/backfill-dj-specialty.mjs --env <path>       # .env.local elsewhere
 *
 * Source: data/filter-extraction/dj-style-pass-2026-11-28.json, one row per DJ,
 * every style carrying a verbatim quote and the URL (or packet section) it came
 * from. Rules are Kiara's (2026-11-28), and docs/vendor-filter-coverage.md has
 * the numbers:
 *   - `specialty` is open format and/or every genre the DJ NAMES, at
 *     `specialty` or `listed` strength alike. `inferred` (a business name, a
 *     weak hint) never counts.
 *   - Open format is a specialty that never hides a DJ (`nonExcluding` on the
 *     filter); a DJ whose other named genres miss the pick is hidden, and one
 *     with no specialty is partial.
 *   - Merges onto the 11 values in VENDOR_FILTERS.dj (MERGE below).
 *
 * Per vendor it replaces the `specialty` key only (every other filter is
 * untouched), records `filters_meta.specialty` with each value's evidence,
 * and lifts `filters_source` from extraction/null to "recon" -- the same move
 * scripts/price-offers/apply-planners.mjs makes, because
 * scripts/backfill-vendor-filters.mjs replaces `filters` wholesale on
 * extraction rows and would otherwise erase this. Skips a row (or a key) a
 * human set by hand. A DJ with no specialty is left alone rather than having a
 * key deleted. Idempotent.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { VENDOR_FILTERS } from "../lib/constants/vendor-filters.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const envArg = args.indexOf("--env");
const SRC = resolve(ROOT, "data/filter-extraction/dj-style-pass-2026-11-28.json");

/** Research slugs -> filter values. Anything absent maps to itself. */
const MERGE = {
  festival_bass: "edm_house",
  funk_soul: "throwback",
  "new:bluegrass_folk": "country",
  top40_pop: "pop_top40",
  rock_indie: "rock",
};

const allowed = new Set(
  (VENDOR_FILTERS.dj ?? []).find((d) => d.key === "specialty")?.options?.map((o) => o.value) ?? [],
);
if (!allowed.size) throw new Error("VENDOR_FILTERS.dj has no specialty filter");

/** One DJ's research row -> { values, evidence } (values sorted, deduped). */
export function specialtyOf(row) {
  const evidence = [];
  for (const s of row.styles ?? []) {
    if (s.strength !== "specialty" && s.strength !== "listed") continue;
    const value = MERGE[s.slug] ?? s.slug;
    if (!allowed.has(value)) throw new Error(`${row.name}: unmapped style ${s.slug}`);
    evidence.push({ value, strength: s.strength, quote: s.evidence, source: s.source });
  }
  // A Spanish-speaking MC is a Latin-wedding offering (Kiara accepted the merge).
  for (const f of row.formats ?? []) {
    if (f.slug === "bilingual_mc" && /span/i.test(f.evidence ?? "")) {
      evidence.push({ value: "latin", strength: "listed", quote: f.evidence, source: f.source });
    }
  }
  const values = [...new Set(evidence.map((e) => e.value))].sort();
  return { values, evidence };
}

// --- env: .env.local wins over the shell for the two keys this needs --------
const envFile = envArg >= 0 ? resolve(args[envArg + 1]) : resolve(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    const q = v.match(/^(["'])(.*)\1/);
    v = q ? q[2] : v.replace(/\s+#.*$/, "").trim();
    if (["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].includes(m[1]) || !process.env[m[1]]) {
      process.env[m[1]] = v;
    }
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !/^https?:\/\//i.test(url)) {
  console.error("Missing or invalid NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pass --env <path>).");
  process.exit(1);
}
console.log(`Supabase: ${new URL(url).host}\n`);
const db = createClient(url, key, { auth: { persistSession: false } });

const rows = JSON.parse(readFileSync(SRC, "utf8"));
const tally = Object.fromEntries([...allowed].map((v) => [v, 0]));
let written = 0, unchanged = 0, none = 0, manual = 0, missing = 0;

for (const row of rows.sort((a, b) => a.name.localeCompare(b.name))) {
  const { values, evidence } = specialtyOf(row);
  if (!values.length) { none++; continue; }
  for (const v of values) tally[v]++;

  // Fresh read right before the write, so a concurrent edit is not clobbered.
  const { data: live, error } = await db
    .from("vendors")
    .select("name, vendor_type, filters, filters_meta, filters_source")
    .eq("id", row.id)
    .maybeSingle();
  if (error || !live) { console.log(`  MISSING ${row.name} (${row.id})`); missing++; continue; }
  if (live.vendor_type !== "dj") { console.log(`  SKIP ${live.name}: now typed ${live.vendor_type}`); missing++; continue; }
  if (live.filters_source === "manual" || live.filters_meta?.specialty?.source === "manual") {
    console.log(`  SKIP ${live.name}: set by hand, review manually`);
    manual++;
    continue;
  }
  if (JSON.stringify(live.filters?.specialty ?? null) === JSON.stringify(values)) { unchanged++; continue; }

  const stamp = new Date().toISOString();
  const filters = { ...(live.filters ?? {}), specialty: values };
  const meta = {
    ...(live.filters_meta ?? {}),
    specialty: { source: "extraction", updated_at: stamp, pass: "dj-style-pass-2026-11-28", evidence },
  };
  const source = live.filters_source == null || live.filters_source === "extraction" ? "recon" : live.filters_source;
  console.log(`  ${APPLY ? "WRITE" : "would write"} ${live.name}: ${values.join(", ")}`);
  if (APPLY) {
    const { error: e2 } = await db
      .from("vendors")
      .update({ filters, filters_meta: meta, filters_source: source, filters_updated_at: stamp })
      .eq("id", row.id);
    if (e2) { console.error(`  FAILED ${live.name}: ${e2.message}`); continue; }
  }
  written++;
}

console.log(`\nper value: ${Object.entries(tally).map(([v, n]) => `${v} ${n}`).join(" · ")}`);
console.log(
  `${APPLY ? "written" : "would write"}: ${written}; unchanged: ${unchanged}; ` +
    `no specialty (left alone): ${none}; manual (skipped): ${manual}; missing/retyped: ${missing}`,
);
if (!APPLY) console.log("Dry run. Re-run with --apply to write.");
