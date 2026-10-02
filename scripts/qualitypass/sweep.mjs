#!/usr/bin/env node
/**
 * Cleanup step 3 (docs/bot-recon-quality-plan.md): one mechanical sweep over the
 * live export, collecting every DETECTABLE defect per vendor, so the judgment
 * pass that follows gets one packet per vendor with the known problems already
 * pointed out (and fixes everything on that vendor in one visit to its site).
 *
 *   node scripts/qualitypass/sweep.mjs --dir data/qualitypass [--contam <contam-live.json>]
 *
 * Reads  <dir>/live-entries.json, <dir>/live-vendors.json (export.mjs output),
 *        <dir>/cleanup/dossiers/<workdir>/<slug>/dossier.md (dossier.mjs --out, new format)
 * Writes <dir>/cleanup/issues.json   { vendor_id: { vendor, entries: [...], vendor_issues: [...] } }
 *
 * Detectors only; nothing here decides a fix. Each detector is the SAME code the
 * drafting gates now run (prose-gate.mjs, provenance.mjs), so "flagged here" and
 * "would fail a fresh upload" mean the same thing.
 */

import fs from "node:fs";
import path from "node:path";
import { arg } from "../reconcile/lib.mjs";
import { researchIndex } from "../reconcile/evidence.mjs";
import { toolingTell, dossierMarker, priceContradiction, gateText } from "../reconcile/prose-gate.mjs";
import { siteUnread, absenceClaims, identityBlocked, BOT_CAP } from "../../.claude/skills/enrichvendors/scripts/provenance.mjs";

const DIR = arg("dir", "data/qualitypass");
const CONTAM = arg("contam");
// The cleanup's own writes stamp updated_at too (date moves, fixes), so "edited
// after drafting by the Aug reconcile pass" must be read off the PRE-cleanup
// export, or every date-moved entry looks reconcile-edited.
const BASELINE = arg("baseline");
const baselineUpdated = BASELINE
  ? new Map(JSON.parse(fs.readFileSync(BASELINE, "utf8")).map((e) => [e.id, e.updated_at]))
  : null;
const FIXED = new Set(["venue", "hotel", "dress"]); // FIXED_LOCATION_TYPES: no service_region

const entries = JSON.parse(fs.readFileSync(path.join(DIR, "live-entries.json"), "utf8")).filter((e) => e.status === "active");
const vendors = new Map(JSON.parse(fs.readFileSync(path.join(DIR, "live-vendors.json"), "utf8")).map((v) => [v.id, v]));

// --- new-format dossiers, keyed by vendor_id ---------------------------------
const dossiers = new Map();
const droot = path.join(DIR, "cleanup/dossiers");
for (const wd of fs.existsSync(droot) ? fs.readdirSync(droot) : []) {
  const wdir = path.join(droot, wd);
  if (!fs.statSync(wdir).isDirectory()) continue;
  for (const slug of fs.readdirSync(wdir)) {
    const p = path.join(wdir, slug, "dossier.md");
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const m = text.match(/vendor_id=([0-9a-f-]{36})/);
    if (!m) continue;
    if (!dossiers.has(m[1])) dossiers.set(m[1], []);
    dossiers.get(m[1]).push({ path: p, dir: path.dirname(p), text });
  }
}

// --- draft text, to find sentences written AFTER drafting (reconcile appends) -
function parseCSV(t) {
  const rows = []; let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { r.push(f); f = ""; } else if (c === "\n") { r.push(f); rows.push(r); r = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}
const drafts = new Map(); // vendor_id -> [draft text]
const addDraft = (vid, text) => { if (!vid) return; if (!drafts.has(vid)) drafts.set(vid, []); drafts.get(vid).push(text); };
const dataRoot = path.resolve(DIR, "..");
function walk(d) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) { if (!["photos", "research", "qualitypass"].includes(n.name)) walk(p); continue; }
    if (n.name.endsWith(".csv")) {
      const rows = parseCSV(fs.readFileSync(p, "utf8"));
      const h = rows[0] || [];
      const vi = h.indexOf("vendor_id");
      if (vi < 0) continue;
      const cols = ["price_text", "price_details", "notes"].map((c) => h.indexOf(c)).filter((i) => i >= 0);
      for (const r of rows.slice(1)) addDraft(r[vi], cols.map((i) => r[i] || "").join(" "));
    } else if (/worker-\d+\.jsonl$/.test(n.name)) {
      for (const l of fs.readFileSync(p, "utf8").split("\n")) {
        try { const o = JSON.parse(l); addDraft(o.vendor_id, `${o.price_text || ""} ${o.price_details || ""} ${o.notes || ""}`); } catch { /* partial worker line */ }
      }
    }
  }
}
for (const d of ["enrichvendors", "enrichvenues"]) if (fs.existsSync(path.join(dataRoot, d))) walk(path.join(dataRoot, d));

const norm = (s) => gateText(s).toLowerCase().replace(/\\n/g, " ").replace(/[^a-z0-9$]+/g, " ").trim();
const sentences = (s) => gateText(s || "").replace(/\\n/g, "\n").split(/(?<=[.!?])\s+|\n|\s-(?=\S)/).map((x) => x.trim()).filter((x) => norm(x).split(" ").length >= 4);

// Migration 0036 swapped the retired "Quote only" for these, so they differ from
// the draft without being anything the reconcile pass wrote.
const QUOTE_ONLY_REWORDING = /^-?\s*(no quote (found|provided)|didn.t get a quote)/i;

const contam = new Map();
if (CONTAM && fs.existsSync(CONTAM)) for (const c of JSON.parse(fs.readFileSync(CONTAM, "utf8"))) contam.set(c.id, c.hits);

// --- sweep -----------------------------------------------------------------
const index = researchIndex();
const byVendor = new Map();
for (const e of entries) { if (!byVendor.has(e.vendor_id)) byVendor.set(e.vendor_id, []); byVendor.get(e.vendor_id).push(e); }

const out = {};
const counts = {};
const bump = (k) => (counts[k] = (counts[k] || 0) + 1);
for (const [vid, es] of byVendor) {
  const v = vendors.get(vid);
  const ds = dossiers.get(vid) ?? [];
  const dossierText = ds.map((d) => d.text).join("\n");
  const vendorIssues = [];
  if (es.length > BOT_CAP) vendorIssues.push({ kind: "over-bot-cap", detail: `${es.length} active bot entries (cap ${BOT_CAP})` });
  const idBlock = ds.map((d) => identityBlocked(d.text, d.dir)).find(Boolean);
  if (idBlock) vendorIssues.push({ kind: "identity-check-failed", detail: idBlock });
  if (!v?.location) vendorIssues.push({ kind: "no-location", detail: "invisible on the map and in search" });
  if (!v?.website) vendorIssues.push({ kind: "no-website", detail: "vendors.website is empty" });
  if (!ds.length) vendorIssues.push({ kind: "no-dossier", detail: "no research dossier found" });
  const unread = siteUnread(dossierText);

  const entryIssues = [];
  for (const e of es) {
    const issues = [];
    const card = { price_text: e.price_text, price_details: e.price_details, notes: e.notes };
    const all = `${e.price_text ?? ""} ${e.price_details ?? ""} ${e.notes ?? ""}`;
    for (const f of ["price_text", "price_details", "notes"]) {
      const t = toolingTell(e[f]);
      if (t) issues.push({ kind: "tooling-language", field: f, detail: `${t.kind} "${t.match}"` });
      const mk = dossierMarker(e[f]);
      if (mk) issues.push({ kind: "dossier-marker", field: f, detail: mk });
    }
    if (unread) for (const a of absenceClaims(all)) issues.push({ kind: "absence-claim-unread-site", detail: `${a.family}: "${a.clause ?? a.match ?? ""}" (${unread})` });
    const pc = priceContradiction(card);
    if (pc) issues.push({ kind: "price-contradiction", detail: pc });
    if (v && !FIXED.has(v.vendor_type) && !String(e.service_region ?? "").trim()) issues.push({ kind: "missing-service-region", detail: "required for service-area types" });
    if (v && FIXED.has(v.vendor_type) && String(e.service_region ?? "").trim()) issues.push({ kind: "service-region-on-fixed-type", detail: e.service_region });
    for (const h of contam.get(e.id) ?? []) issues.push({ kind: "cross-vendor-contamination", detail: `"${h.phrase}" appears only in ${h.siblings.join(", ")}'s research` });
    // Only entries the reconcile pass touched (it sets updated_at). Text that
    // differs from the drafts WITHOUT updated_at is the 0036 quote-only rewording
    // and the hand-applied SQL fixes, which never stamped updated_at - not appends.
    const reconTouched = baselineUpdated ? baselineUpdated.get(e.id) : e.updated_at;
    const draftBlob = reconTouched ? (drafts.get(vid) ?? []).map(norm).join(" || ") : "";
    const added = draftBlob ? sentences(`${e.price_text ?? ""}\n${e.price_details ?? ""}\n${e.notes ?? ""}`).filter((s) => !draftBlob.includes(norm(s)) && !QUOTE_ONLY_REWORDING.test(s)) : [];
    if (added.length) issues.push({ kind: "added-after-drafting", detail: added });
    else if (!draftBlob && reconTouched) issues.push({ kind: "edited-no-draft-on-file", detail: `updated ${e.updated_at.slice(0, 10)}, no draft text found to diff against` });
    for (const i of issues) bump(i.kind);
    entryIssues.push({ entry_id: e.id, author: e.author, collected: `${e.recon_collected_month}/${e.recon_collected_year}`, updated_at: e.updated_at, photos: (e.recon_media || []).length, issues });
  }
  for (const i of vendorIssues) bump(i.kind);
  out[vid] = {
    vendor: v && { id: v.id, name: v.name, vendor_type: v.vendor_type, city: v.city, website: v.website, has_location: Boolean(v.location) },
    research_dirs: (index.get(vid) ?? []).map((r) => r.dir),
    new_dossiers: ds.map((d) => d.path),
    vendor_issues: vendorIssues,
    entries: entryIssues,
  };
}

fs.writeFileSync(path.join(DIR, "cleanup/issues.json"), JSON.stringify(out, null, 1));
const vals = Object.values(out);
const flagged = vals.filter((x) => x.vendor_issues.length || x.entries.some((e) => e.issues.length));
console.log({ vendors: vals.length, vendorsWithAnyIssue: flagged.length, entries: entries.length, entriesWithAnyIssue: vals.flatMap((x) => x.entries).filter((e) => e.issues.length).length, counts });
