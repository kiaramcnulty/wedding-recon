#!/usr/bin/env node
/**
 * Turn a fix batch's agent outputs into the two sheets Kiara reviews before
 * anything is applied (docs/bot-recon-quality-plan.md, cleanup step 5):
 *
 *   proposed-changes.csv  one row per changed FIELD of the change list: the
 *                         live value now vs the proposed value (filters shown
 *                         as the changed keys only), reason, evidence. The
 *                         `change` number is the line in changes-all.jsonl, so
 *                         "drop change 12" maps to exactly one apply line.
 *   review.csv            every decision behind it (keeps included), then the
 *                         questions only Kiara can answer, then flags left for
 *                         the full review pass.
 *
 *   node scripts/qualitypass/review-sheets.mjs --batch <dir with out/> --dir data/qualitypass
 */

import fs from "node:fs";
import path from "node:path";
import { arg } from "../reconcile/lib.mjs";

const BATCH = arg("batch");
const DIR = arg("dir", "data/qualitypass");
if (!BATCH) {
  console.error("Usage: review-sheets.mjs --batch <batch dir> [--dir <qualitypass dir>]");
  process.exit(1);
}
const out = path.join(BATCH, "out");
const readJsonl = (p) =>
  fs.readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const group = (prefix) => fs.readdirSync(out).filter((f) => new RegExp(`^${prefix}-\\d+\\.jsonl$`).test(f)).sort().flatMap((f) => readJsonl(path.join(out, f)));
const esc = (x) => { const s = x == null ? "" : typeof x === "string" ? x : JSON.stringify(x); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (cols, rows) => [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";

const changes = group("changes");
fs.writeFileSync(path.join(out, "changes-all.jsonl"), changes.map((c) => JSON.stringify(c)).join("\n") + "\n");
const entries = new Map(JSON.parse(fs.readFileSync(path.join(DIR, "live-entries.json"), "utf8")).map((e) => [e.id, e]));
const vendors = new Map(JSON.parse(fs.readFileSync(path.join(DIR, "live-vendors.json"), "utf8")).map((v) => [v.id, v]));

const fieldRows = [];
changes.forEach((c, i) => {
  const e = c.table === "recon_entries" ? entries.get(c.id) : null;
  const v = vendors.get(e ? e.vendor_id : c.id);
  for (const [f, next] of Object.entries(c.set)) {
    if (f === "filters_meta") continue;
    const cur = e ? e[f] : v?.[f];
    let current = cur;
    let proposed = next;
    if (f === "filters") {
      const a = cur || {};
      const b = next || {};
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      current = keys.map((k) => `${k}: ${k in a ? JSON.stringify(a[k]) : "(none)"}`).join("\n");
      proposed = keys.map((k) => `${k}: ${k in b ? JSON.stringify(b[k]) : "(removed)"}`).join("\n");
    }
    fieldRows.push({
      change: i + 1, vendor_type: v?.vendor_type, vendor: v?.name,
      what: c.table === "vendors" ? "vendor row" : `entry ${c.id.slice(0, 8)}`, field: f,
      current, proposed, extra_fix: c.extra ? "yes" : "", reason: c.reason,
      evidence: (c.evidence || []).map((x) => `${x.source || ""}${x.quote ? ` - "${x.quote}"` : ""}`).join("\n"),
      vendor_page: v ? `https://www.weddingrecon.com/vendor/${v.id}` : "",
    });
  }
});
fieldRows.sort((a, b) => String(a.vendor).localeCompare(String(b.vendor)) || a.change - b.change);
fs.writeFileSync(path.join(BATCH, "proposed-changes.csv"), csv(["change", "vendor_type", "vendor", "what", "field", "current", "proposed", "extra_fix", "reason", "evidence", "vendor_page"], fieldRows));

const review = [
  ...group("review").map((r) => ({ section: "1 decision behind a change", ...r })),
  ...group("decisions").map((r) => ({ section: "2 question for Kiara", ...r })),
  ...group("flags").map((r) => ({ section: "3 flag for the full review", ...r })),
];
const rank = { "1 decision behind a change": 0, "2 question for Kiara": 1, "3 flag for the full review": 2 };
review.sort((a, b) => rank[a.section] - rank[b.section] || String(a.vendor_name).localeCompare(String(b.vendor_name)));
fs.writeFileSync(path.join(BATCH, "review.csv"), csv(["section", "vendor_type", "vendor_name", "issue", "verdict", "before", "after", "why", "evidence_url", "confidence", "entry_id", "vendor_id"], review));

const by = (rows, k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
console.log({ changeLines: changes.length, fieldRows: fieldRows.length, fields: by(fieldRows, "field"), reviewRows: review.length, sections: by(review, "section") });
