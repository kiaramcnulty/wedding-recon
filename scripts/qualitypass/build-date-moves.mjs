#!/usr/bin/env node
/**
 * Cleanup item 2 (docs/bot-recon-quality-plan.md): live bot entries dated
 * earlier than the newest source they quote ("4/2025" card citing "a recent
 * review from may 2026"). Kiara, 2026-10-02: move them forward automatically.
 *
 *   node scripts/qualitypass/build-date-moves.mjs --export <entries.json> --out <change-list.jsonl>
 *
 * Uses the SAME planner the drafting pipeline now enforces (provenance.mjs
 * planDateMoves), over every vendor's harvested reviews across all of its
 * research dirs, so a live entry and a freshly drafted one are judged alike.
 * Siblings stay on distinct months where any month is left between the floor
 * and the harvest month; where none is, the move still happens (an impossible
 * date is worse than a shared one) and is listed as a conflict.
 */

import fs from "node:fs";
import path from "node:path";
import { arg } from "../reconcile/lib.mjs";
import { researchIndex } from "../reconcile/evidence.mjs";
import {
  planDateMoves, reviewsFromHarvest, harvestCeiling, buildDocFreq, dossierBackground,
} from "../../.claude/skills/enrichvendors/scripts/provenance.mjs";

const EXPORT = arg("export");
const OUT = arg("out");
if (!EXPORT || !OUT) {
  console.error("Usage: build-date-moves.mjs --export <entries.json> --out <change-list.jsonl>");
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(EXPORT, "utf8")).filter((e) => e.status === "active");
const index = researchIndex();
const research = new Map();
const allReviewTexts = [];
for (const vid of new Set(entries.map((e) => e.vendor_id))) {
  const reviews = new Map();
  let ceiling = null;
  let background = "";
  for (const { dir } of index.get(vid) ?? []) {
    const hp = path.join(dir, "harvest.json");
    if (fs.existsSync(hp)) {
      const h = JSON.parse(fs.readFileSync(hp, "utf8"));
      for (const r of reviewsFromHarvest(h)) reviews.set(r.text, r);
      const c = harvestCeiling(h);
      if (!ceiling || c.year * 12 + c.month > ceiling.year * 12 + ceiling.month) ceiling = c;
    }
    const dp = path.join(dir, "dossier.md");
    if (fs.existsSync(dp)) background += "\n" + dossierBackground(fs.readFileSync(dp, "utf8"));
  }
  research.set(vid, { reviews: [...reviews.values()], ceiling, background });
  allReviewTexts.push(...[...reviews.values()].map((r) => r.text));
}
const docFreq = buildDocFreq(allReviewTexts);

const plan = planDateMoves(
  entries.map((e) => ({
    key: e.id, vendor_id: e.vendor_id, month: e.recon_collected_month, year: e.recon_collected_year,
    text: `${e.price_text ?? ""} ${e.price_details ?? ""} ${e.notes ?? ""}`,
  })),
  {
    reviewsFor: (vid) => research.get(vid)?.reviews ?? [],
    ceilingFor: (vid) => research.get(vid)?.ceiling ?? null,
    backgroundFor: (vid) => research.get(vid)?.background ?? "",
    docFreq,
  },
);

const byId = new Map(entries.map((e) => [e.id, e]));
const conflictKeys = new Set(plan.conflicts.map((c) => c.key));
const lines = plan.moves.map((m) => {
  const e = byId.get(m.key);
  return JSON.stringify({
    table: "recon_entries",
    id: m.key,
    set: { recon_collected_month: m.to.month, recon_collected_year: m.to.year },
    expect: { recon_collected_month: e.recon_collected_month, recon_collected_year: e.recon_collected_year, status: "active" },
    reason: `plan item 2: dated ${m.from.month}/${m.from.year} but uses a newer source (${m.evidence.join("; ")})${conflictKeys.has(m.key) ? "; no distinct sibling month left" : ""}`,
  });
});
fs.writeFileSync(OUT, lines.join("\n") + (lines.length ? "\n" : ""));
const gaps = plan.moves.map((m) => (m.to.year * 12 + m.to.month) - (m.from.year * 12 + m.from.month)).sort((a, b) => a - b);
console.log({
  entries: entries.length,
  moves: plan.moves.length,
  conflicts: plan.conflicts.length,
  clamped: plan.clamped.length,
  medianMonths: gaps[Math.floor(gaps.length / 2)] ?? 0,
  out: OUT,
});
