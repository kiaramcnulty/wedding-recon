// Builds the "Colorado Wedding Vendor Pricing & Details" giveaway workbook.
//
// Data comes straight from the hosted DB (`vendors.filters`, already extracted —
// no re-extraction, no paid API). Each vendor type becomes a tab whose columns
// are that type's filter facets, EXPLODED one facet per column and rendered with
// the app's own definitions (`filtersForType`) so the sheet can never disagree
// with what the site shows. Prices are kept in each vendor's own basis (a
// "Price basis" column sits beside them) rather than normalized — high fidelity
// over false comparability.
//
// Run (from repo root):
//   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//        --import ./scripts/cost-sheet/loader.mjs --env-file=.env.local \
//        ./scripts/cost-sheet/build.ts [outPath]

import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { filtersForType } from "@/lib/constants/vendor-filters";
import { writeXlsx } from "./xlsx.mjs";

// ---- config -----------------------------------------------------------------

// Hardcoded prod origin on purpose: NEXT_PUBLIC_SITE_URL may be localhost/preview
// in .env.local, and this link is published.
const SITE = "https://weddingrecon.com";
const UTM = "?utm_source=spreadsheet&utm_medium=referral&utm_campaign=co-cost-sheet";

// Tab order (prominence first) → [vendor_type, tab label].
const TABS: [string, string][] = [
  ["venue", "Venues"],
  ["food", "Catering"],
  ["photos", "Photography"],
  ["flowers", "Florals"],
  ["dj", "DJs"],
  ["band", "Live Music"],
  ["planner", "Planners"],
  ["beauty", "Hair & Makeup"],
  ["dress", "Bridal Shops"],
  ["hotel", "Hotel Blocks"],
];

const IG_TYPES = new Set(["photos", "dress", "beauty"]);

const BASIS: Record<string, string> = {
  package: "Package (total)",
  per_person: "Per person",
  per_hour: "Per hour",
  per_night: "Per night",
  per_gown: "Per gown",
  per_item: "Per item",
};

// City → metro bucket. Front-range metros are explicit; everything else (heavily
// mountain resort towns) falls to "Mountains & other".
const METRO: Record<string, string[]> = {
  "Denver metro": ["denver", "aurora", "lakewood", "arvada", "westminster", "thornton", "centennial", "littleton", "englewood", "parker", "castle rock", "brighton", "commerce city", "wheat ridge", "golden", "broomfield", "highlands ranch", "lone tree", "greenwood village", "morrison", "evergreen", "franktown", "sedalia", "henderson", "northglenn"],
  Boulder: ["boulder", "longmont", "louisville", "lafayette", "superior", "niwot", "erie", "nederland"],
  "Colorado Springs": ["colorado springs", "monument", "manitou springs", "fountain", "peyton", "falcon", "black forest", "larkspur"],
  "Fort Collins / NoCo": ["fort collins", "loveland", "greeley", "windsor", "estes park", "wellington", "timnath", "berthoud", "johnstown", "eaton"],
};
const METRO_LOOKUP = new Map<string, string>();
for (const [bucket, cities] of Object.entries(METRO)) for (const c of cities) METRO_LOOKUP.set(c, bucket);
const metro = (city?: string) => METRO_LOOKUP.get((city || "").trim().toLowerCase()) || "Mountains & other";

// ---- small helpers ----------------------------------------------------------

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

function priceLoHi(f: any): [number | undefined, number | undefined] {
  let lo = num(f.price_min);
  let hi = num(f.price_max);
  if (lo === undefined && hi === undefined && Array.isArray(f.price_tiers)) {
    const mins = f.price_tiers.map((t: any) => num(t.min)).filter((x: any) => x !== undefined);
    const maxs = f.price_tiers.map((t: any) => num(t.max)).filter((x: any) => x !== undefined);
    if (mins.length) lo = Math.min(...mins);
    if (maxs.length) hi = Math.max(...maxs);
  }
  return [lo, hi];
}
function rangeLoHi(f: any, def: any): [number | undefined, number | undefined] {
  if (def.key === "price") return priceLoHi(f);
  return [num(f[def.lo ?? def.key]), num(f[def.hi ?? def.lo ?? def.key])];
}
function multiVal(f: any, def: any): string {
  const raw = f[def.key];
  if (!Array.isArray(raw)) return "";
  const present = new Set(raw.map(String));
  return (def.options ?? []).filter((o: any) => present.has(o.value)).map((o: any) => o.label).join(", ");
}
function website(w?: string): string {
  if (!w) return "";
  return /^https?:\/\//i.test(w) ? w : "https://" + w;
}
function ig(h?: string): string {
  if (!h) return "";
  const handle = String(h).trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
  return handle ? "https://instagram.com/" + handle : "";
}
const wrUrl = (id: string) => `${SITE}/vendor/${id}${UTM}`;

// The vendor's first usd figure — used only to sort a tab (priced first, ascending).
function primaryPrice(type: string, f: any): number | undefined {
  if (!f) return undefined;
  for (const def of filtersForType(type as any)) if (def.unit === "usd") return rangeLoHi(f, def)[0];
  return undefined;
}

type Col = { header: string; kind: string; width: number; val: (v: any, f: any) => any };

function typeColumns(type: string): Col[] {
  const cols: Col[] = [];
  const push = (header: string, kind: string, width: number, val: (v: any, f: any) => any) =>
    cols.push({ header, kind, width, val });

  push("Vendor", "text", 30, (v) => v.name);
  push("Wedding Recon page", "text", 44, (v) => wrUrl(v.id));
  push("City", "text", 18, (v) => v.city || "");
  push("Metro area", "text", 18, (v) => metro(v.city));
  push("Website", "text", 34, (v) => website(v.website));
  if (IG_TYPES.has(type)) push("Instagram", "text", 30, (v) => ig(v.instagram));

  for (const def of filtersForType(type as any)) {
    if (def.kind === "bool") {
      push(def.label, "text", Math.max(12, def.label.length + 2), (_v, f) => (f && f[def.key] === true ? "Yes" : ""));
      continue;
    }
    if (def.kind === "multi") {
      push(def.label, "text", 28, (_v, f) => (f ? multiVal(f, def) : ""));
      // Hotel min_rooms isn't an app filter facet, so add it here (grouped after
      // Block type) rather than inventing a filter def.
      if (type === "hotel" && def.key === "block_type") {
        push("Min rooms", "num", 12, (_v, f) => (f ? num(f.min_rooms) : undefined));
      }
      continue;
    }
    // range
    if (def.unit === "guests") {
      push("Max guests", "num", 12, (_v, f) => (f ? num(f[def.key]) : undefined));
      continue;
    }
    if (def.unit === "weeks") {
      push("Delivery (weeks)", "num", 15, (_v, f) => (f ? num(f[def.key]) : undefined));
      continue;
    }
    if (def.unit === "usd") {
      if (def.mode === "point") {
        push(`${def.label} ($)`, "currency", 16, (_v, f) => (f ? rangeLoHi(f, def)[0] : undefined));
        continue;
      }
      push(`${def.label} from ($)`, "currency", 16, (_v, f) => (f ? rangeLoHi(f, def)[0] : undefined));
      push(`${def.label} to ($)`, "currency", 16, (_v, f) => {
        if (!f) return undefined;
        const [lo, hi] = rangeLoHi(f, def);
        return hi !== undefined && hi !== lo ? hi : undefined;
      });
      if (def.key === "price") push("Price basis", "text", 18, (_v, f) => (f ? BASIS[f.price_basis] || "" : ""));
    }
  }
  return cols;
}

// ---- readme -----------------------------------------------------------------

function readmeSheet() {
  const asOf = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const rows: any[] = [];
  const title = (s: string) => rows.push([{ v: s, kind: "title" }]);
  const line = (s: string) => rows.push([{ v: s, kind: "text" }]);
  const blank = () => rows.push([]);

  title("Colorado Wedding Vendor Pricing & Details");
  blank();
  line("A free, shareable snapshot of wedding vendors across Colorado — pricing and details, organized by vendor type (one tab each).");
  line("Built by Wedding Recon (weddingrecon.com), a free tool for engaged couples to explore local vendors and log their own price quotes and notes.");
  blank();
  line("HOW TO READ IT");
  line("• Each tab is one vendor type. Turn on filters (the funnel icon) to sort by price or narrow by any column.");
  line("• Prices are shown in each vendor's own basis — per person, per package, per gown, and so on. Check the \"Price basis\" column before comparing two numbers.");
  line("• A blank cell means we don't have that detail — not that the answer is \"no\".");
  line("• Every vendor links to its Wedding Recon page, where you'll find photos, full quotes, a map, and couples' notes.");
  blank();
  line("WHERE THE DATA COMES FROM — PLEASE READ");
  line("All attributes — pricing, capacity, catering, styles, and everything else — were gathered from public sources: vendors' own websites, couples' shared quotes, third-party listing sites, and details inferred from reviews.");
  line("Some of it may be out of date or incomplete. Always verify directly with the vendor before making any decision.");
  blank();
  line("As of: " + asOf + " (data collected mid-2026).");
  blank();
  line("Explore the living version, or add your own quotes, at weddingrecon.com.");
  line("Are you a vendor and something looks off? Head to weddingrecon.com to get in touch and we'll fix it.");

  return { name: "READ ME", rows, cols: [118], freeze: false, filter: false };
}

// ---- stats (console only — caption fodder, not a tab) -----------------------

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ---- main -------------------------------------------------------------------

async function main() {
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[k]) {
      console.error(`${k} missing — run with --env-file=.env.local from the repo root`);
      process.exit(1);
    }
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // pull every vendor, paginated (PostgREST caps a page at 1000)
  const cols = "id,name,vendor_type,city,region,website,instagram,filters";
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("vendors").select(cols).order("name").range(from, from + 999);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  console.log(`pulled ${all.length} vendors`);

  const byType = new Map<string, any[]>();
  for (const v of all) {
    if (!byType.has(v.vendor_type)) byType.set(v.vendor_type, []);
    byType.get(v.vendor_type)!.push(v);
  }
  const known = new Set(TABS.map(([t]) => t));
  const unmapped = all.filter((v) => !known.has(v.vendor_type));
  if (unmapped.length) {
    const brk: Record<string, number> = {};
    for (const v of unmapped) brk[v.vendor_type] = (brk[v.vendor_type] || 0) + 1;
    console.log(`skipped ${unmapped.length} vendors of non-tabbed types:`, brk);
  }

  const sheets: any[] = [readmeSheet()];
  console.log("\ntype           vendors  priced   p25 / median / p75 (first usd figure)");
  for (const [type, tabName] of TABS) {
    // Default order is name A→Z, not price-ascending. Prices sit in several
    // bases within one tab (a $10/hr community room, a $12/person taco caterer,
    // a $20 single-stem floral misextraction), so sorting by the raw figure
    // would open every tab on its oddest-looking rows and read as broken. The
    // autofilter lets a couple sort by any price column themselves.
    const vs = (byType.get(type) || []).slice();
    vs.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    const columns = typeColumns(type);
    const header = columns.map((c) => ({ v: c.header, kind: "header" }));
    const rows: any[] = [header];
    for (const v of vs) rows.push(columns.map((c) => ({ v: c.val(v, v.filters || null), kind: c.kind })));
    sheets.push({ name: tabName, rows, cols: columns.map((c) => c.width), freeze: true, filter: true });

    const priced = vs.map((v) => primaryPrice(type, v.filters)).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
    const fmt = (n: number) => (Number.isFinite(n) ? "$" + Math.round(n).toLocaleString() : "—");
    const stat = priced.length
      ? `${fmt(quantile(priced, 0.25))} / ${fmt(quantile(priced, 0.5))} / ${fmt(quantile(priced, 0.75))}`
      : "—";
    console.log(`${tabName.padEnd(14)} ${String(vs.length).padStart(6)} ${String(priced.length).padStart(7)}   ${stat}`);
  }

  const out = process.argv[2] || path.join(process.env.WR_ROOT || process.cwd(), "2026_colorado_wedding_costs.xlsx");
  writeXlsx(out, sheets);
  console.log(`\nwrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
