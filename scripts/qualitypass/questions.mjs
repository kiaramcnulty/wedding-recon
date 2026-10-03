#!/usr/bin/env node
/**
 * Collect every fix batch's open questions for Kiara into ONE sheet, so a run of
 * several batches is reviewed in one sitting (Kiara, 2026-10-03).
 *
 *   node scripts/qualitypass/questions.mjs --cleanup data/qualitypass/cleanup --batches fix-b04,fix-b05 --out <file.csv>
 *
 * One row per decision line in <batch>/out/decisions-*.jsonl, numbered Q1..Qn,
 * with the batch, vendor, what is being asked, what the agent found, and a
 * suggested answer when the agent gave one.
 */

import fs from "node:fs";
import path from "node:path";
import { arg } from "../reconcile/lib.mjs";

const ROOT = arg("cleanup");
const BATCHES = (arg("batches") || "").split(",").filter(Boolean);
const OUT = arg("out");
if (!ROOT || !BATCHES.length || !OUT) {
  console.error("Usage: questions.mjs --cleanup <dir> --batches a,b --out <file.csv>");
  process.exit(1);
}
const esc = (x) => { const s = x == null ? "" : typeof x === "string" ? x : JSON.stringify(x); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const rows = [];
for (const b of BATCHES) {
  const out = path.join(ROOT, b, "out");
  if (!fs.existsSync(out)) continue;
  for (const f of fs.readdirSync(out).filter((f) => /^decisions-\d+\.jsonl$/.test(f)).sort()) {
    for (const l of fs.readFileSync(path.join(out, f), "utf8").split("\n").filter((x) => x.trim())) {
      let d;
      try { d = JSON.parse(l); } catch { continue; }
      rows.push({
        batch: b.replace("fix-", ""),
        vendor: d.vendor_name,
        type: d.vendor_type,
        topic: d.issue || "",
        question: d.question || d.why || d.before || "",
        found: d.found ? JSON.stringify(d.found) : d.why && d.question ? d.why : "",
        suggested: d.after || d.suggestion || "",
        evidence: Array.isArray(d.evidence) ? d.evidence.join(" ") : d.evidence_url || "",
        vendor_page: d.vendor_id ? `https://www.weddingrecon.com/vendor/${d.vendor_id}` : "",
      });
    }
  }
}
rows.forEach((r, i) => (r.q = `Q${i + 1}`));
const cols = ["q", "batch", "type", "vendor", "topic", "question", "found", "suggested", "evidence", "vendor_page"];
fs.writeFileSync(OUT, [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n");
console.log(`${rows.length} question(s) -> ${OUT}`);
