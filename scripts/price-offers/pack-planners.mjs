#!/usr/bin/env node
/**
 * Build per-planner EVIDENCE PACKS for the per-service price pass: the lines of
 * each planner's archived research that could state a price, with the file
 * they came from, so a reader can map prices onto service tiers and quote them
 * verbatim. Reads only local files plus the live planner list; writes nothing
 * but `data/price-offers/planner/`.
 *
 *   node scripts/price-offers/pack-planners.mjs [--api http://localhost:3000]
 *
 * The live list comes from the app's own cached pin route (`attrs=1`), so the
 * dev server must be running. No Google calls, no web fetches, no LLM calls:
 * the reading is done by a person or an agent over the packs.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "data/price-offers/planner");
const API = process.argv.includes("--api") ? process.argv[process.argv.indexOf("--api") + 1] : "http://localhost:3000";
const RESEARCH = ["data/enrichvendors/planner-colorado/research", "data/enrichvendors/filterpass-planner/research"];
const PER_BATCH = 14;
const MAX_PACK_CHARS = 9000;

const PRICEY = /\$\s?\d|\d\s?k\b|\bpric|\binvest|\bpackage|\bstarting|\bstarts at|\bfee\b|\brate\b|\bper hour|\bhourly|\b%\s*of/i;
const TIER = /day[- ]of|month[- ]of|week[- ]of|partial|full[- ]?(service|planning)|coordinat|a la carte|à la carte|elope|destination|design/i;

function text(path) {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

/** Lines worth reading: a price-ish line, plus a little context either side. */
function windows(body, before = 3, after = 3) {
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  const keep = new Set();
  lines.forEach((l, i) => {
    if (!l) return;
    if (/\$\s?\d/.test(l) || (PRICEY.test(l) && TIER.test(l))) {
      for (let j = Math.max(0, i - before); j <= Math.min(lines.length - 1, i + after); j++) keep.add(j);
    }
  });
  const out = [];
  let last = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (!lines[i]) continue;
    if (i > last + 1 && out.length) out.push("…");
    out.push(lines[i]);
    last = i;
  }
  return out.join("\n");
}

// Live planners: id -> { name, filters }.
const qs = new URLSearchParams({ min_lng: "-109.1", min_lat: "36.9", max_lng: "-102", max_lat: "41.1", type: "planner", max_rows: "999", attrs: "1" });
const live = await (await fetch(`${API}/api/map/vendors?${qs}`)).json();

// Research folders by vendor id, newest harvest last.
const dirsById = new Map();
for (const r of RESEARCH) {
  const base = resolve(ROOT, r);
  if (!existsSync(base)) continue;
  for (const slug of readdirSync(base)) {
    const dir = join(base, slug);
    if (!statSync(dir).isDirectory()) continue;
    let h;
    try { h = JSON.parse(text(join(dir, "harvest.json"))); } catch { continue; }
    if (!h?.vendor_id) continue;
    const list = dirsById.get(h.vendor_id) ?? [];
    list.push({ dir, harvest: h });
    dirsById.set(h.vendor_id, list);
  }
}

mkdirSync(join(OUT, "packs"), { recursive: true });
const index = [];
let packed = [];
let batch = 1;
const flush = () => {
  if (!packed.length) return;
  writeFileSync(join(OUT, "packs", `batch-${String(batch).padStart(2, "0")}.md`), packed.join("\n\n---\n\n"));
  batch++;
  packed = [];
};

for (const v of live) {
  const f = v.filters ?? {};
  const sources = dirsById.get(v.id) ?? [];
  const parts = [];
  const seen = new Set();
  let fetchedAt = null;
  for (const { dir, harvest } of sources) {
    fetchedAt = harvest.fetched_at ?? fetchedAt;
    // Reddit slices discuss many vendors at once, so a price in one can belong to
    // someone else: only the vendor's own site, PDFs and Google reviews count.
    const files = readdirSync(dir).filter((n) => n.endsWith(".txt") && !n.includes("feed-xml") && !n.includes("reddit"));
    for (const n of files) {
      const body = text(join(dir, n));
      const key = body.slice(0, 400);
      if (!body || seen.has(key)) continue;
      seen.add(key);
      const w = windows(body);
      if (w) parts.push(`### file: ${relative(ROOT, join(dir, n))}\n${w}`);
    }
    for (const [i, p] of (harvest.pdf_texts ?? []).entries()) {
      const body = typeof p === "string" ? p : p?.text ?? "";
      const w = windows(body);
      if (w) parts.push(`### file: ${relative(ROOT, join(dir, "harvest.json"))} (pdf_texts[${i}])\n${w}`);
    }
    for (const [i, r] of (harvest.google?.reviews ?? []).entries()) {
      if (r?.text && /\$\s?\d/.test(r.text)) {
        parts.push(`### file: ${relative(ROOT, join(dir, "harvest.json"))} (google.reviews[${i}], ${r.when ?? "undated"})\n${r.text}`);
      }
    }
  }
  let evidence = parts.join("\n\n");
  if (evidence.length > MAX_PACK_CHARS) evidence = evidence.slice(0, MAX_PACK_CHARS) + "\n[truncated]";
  index.push({ vendor_id: v.id, name: v.name, research_folders: sources.length, evidence_chars: evidence.length, fetched_at: fetchedAt });
  if (!evidence) continue;
  packed.push(
    [
      `## ${v.name}`,
      `vendor_id: ${v.id}`,
      `research fetched: ${fetchedAt ?? "unknown"}`,
      `current flattened price: min=${f.price_min ?? "-"} max=${f.price_max ?? "-"} kind=${f.price_kind ?? "-"} basis=${f.price_basis ?? "-"}`,
      `current service_tier: ${JSON.stringify(f.service_tier ?? [])}  pricing_model: ${JSON.stringify(f.pricing_model ?? [])}  elopement_price_min: ${f.elopement_price_min ?? "-"}`,
      "",
      evidence,
    ].join("\n"),
  );
  if (packed.length >= PER_BATCH) flush();
}
flush();
writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
const withEvidence = index.filter((i) => i.evidence_chars > 0).length;
console.log(`live planners: ${live.length}; with research: ${index.filter((i) => i.research_folders).length}; with price evidence: ${withEvidence}; batches: ${batch - 1}`);
