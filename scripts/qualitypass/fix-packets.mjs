#!/usr/bin/env node
/**
 * Cleanup step 5 input: one fix packet per vendor, for the judgment agents that
 * turn the sweep's detected defects into a reviewable change list.
 *
 *   node scripts/qualitypass/fix-packets.mjs --dir data/qualitypass --out <dir> [--vendors id,id] [--sample N --seed S]
 *
 * A packet is everything an agent needs to fix that vendor without hunting:
 * the live vendor row (with filters + provenance), every live bot entry, the
 * sweep's issues per entry (with the exact sentences the reconcile pass added),
 * and the paths of the new-format dossier, the raw research and the drafts.
 */

import fs from "node:fs";
import path from "node:path";
import { arg } from "../reconcile/lib.mjs";

const DIR = arg("dir", "data/qualitypass");
const OUT = arg("out");
if (!OUT) {
  console.error("Usage: fix-packets.mjs --dir <qualitypass dir> --out <dir> [--vendors a,b] [--sample N --seed S]");
  process.exit(1);
}
const issues = JSON.parse(fs.readFileSync(path.join(DIR, "cleanup/issues.json"), "utf8"));
const entries = JSON.parse(fs.readFileSync(path.join(DIR, "live-entries.json"), "utf8")).filter((e) => e.status === "active");
const vendors = new Map(JSON.parse(fs.readFileSync(path.join(DIR, "live-vendors.json"), "utf8")).map((v) => [v.id, v]));

let ids = (arg("vendors") || "").split(",").filter(Boolean);
if (!ids.length) {
  const flagged = Object.entries(issues).filter(([, x]) => x.vendor_issues.length || x.entries.some((e) => e.issues.length)).map(([id]) => id);
  const n = parseInt(arg("sample") || "0", 10);
  if (n) {
    // Seeded, and stratified so every defect kind the sweep found is in the sample.
    let s = parseInt(arg("seed") || "1", 10);
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const kinds = (id) => new Set([...issues[id].vendor_issues.map((i) => i.kind), ...issues[id].entries.flatMap((e) => e.issues.map((i) => i.kind))]);
    const pool = [...flagged].sort(() => rnd() - 0.5);
    const allKinds = new Set(pool.flatMap((id) => [...kinds(id)]));
    const pick = new Set();
    for (const k of allKinds) { const id = pool.find((x) => kinds(x).has(k) && !pick.has(x)); if (id) pick.add(id); }
    for (const id of pool) { if (pick.size >= n) break; pick.add(id); }
    ids = [...pick];
  } else ids = flagged;
}

fs.mkdirSync(OUT, { recursive: true });
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
for (const id of ids) {
  const x = issues[id];
  const v = vendors.get(id);
  if (!x || !v) continue;
  const { google_photos, ...row } = v;
  row.google_photos_count = google_photos?.length ?? 0;
  const es = entries.filter((e) => e.vendor_id === id).map(({ author_id, ...e }) => e);
  const md = [
    `# Fix packet: ${v.name} (${v.vendor_type})`,
    "",
    "## Detected issues (from the sweep - fix every one, and flag anything else you notice)",
    "```json",
    JSON.stringify({ vendor_issues: x.vendor_issues, entries: x.entries }, null, 1),
    "```",
    "",
    "## Live vendor row (DB, 2026-10-02)",
    "```json",
    JSON.stringify(row, null, 1),
    "```",
    "",
    `## Live bot entries (${es.length}) - these exact values are what your change list's "expect" must match`,
    "```json",
    JSON.stringify(es, null, 1),
    "```",
    "",
    "## New-format dossier(s) (read first; fee tables and wedding pages are kept whole now)",
    ...(x.new_dossiers.length ? x.new_dossiers.map((p) => `- ${p}`) : ["- none"]),
    "",
    "## Raw research dirs (page-*.txt, harvest.json reviews, reddit-slice.txt; read what you need)",
    ...(x.research_dirs.length ? x.research_dirs.map((p) => `- ${p}`) : ["- none"]),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, `${v.vendor_type}--${slug(v.name)}--${id.slice(0, 8)}.md`), md);
}
console.log(`wrote ${ids.length} packet(s) to ${OUT}`);
