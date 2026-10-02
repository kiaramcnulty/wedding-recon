#!/usr/bin/env node
/**
 * Cleanup item 10 (docs/bot-recon-quality-plan.md): build the input for the
 * photo review. Every live bot-entry photo is downloaded (read-only) from the
 * recon-media bucket and matched BY CONTENT HASH to its local harvested copy,
 * which recovers where it came from (photos/<slug>/manifest.json source_url /
 * source_page). Storage paths are photo-N.jpg under a submission uuid, so a
 * name match is impossible; upload.mjs uploads the local files byte-for-byte,
 * so a hash match is exact.
 *
 *   node --env-file=.env.local scripts/qualitypass/photo-packets.mjs --dir data/qualitypass [--selections <dir>]
 *
 * --selections: a photos.mjs --dry-run --out tree (photos/<slug>/selection.json),
 * so each photo also carries whether the NEW rules (stock host, stock-catalog
 * filename, headshot, logo, other act) would reject it.
 *
 * Writes <dir>/cleanup/photos/<entry_id>/<n>.jpg and <dir>/cleanup/photos.json
 * ([{entry_id, vendor_id, vendor_name, vendor_type, media_id, storage_path,
 *    local, source_url, source_page, alt, new_rule_reject}]).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { arg, serviceClient } from "../reconcile/lib.mjs";

const DIR = arg("dir", "data/qualitypass");
const SEL = arg("selections");
const db = serviceClient();
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

const entries = JSON.parse(fs.readFileSync(path.join(DIR, "live-entries.json"), "utf8")).filter((e) => e.status === "active");
const vendors = new Map(JSON.parse(fs.readFileSync(path.join(DIR, "live-vendors.json"), "utf8")).map((v) => [v.id, v]));
const ids = entries.map((e) => e.id);

// thumb_path is not in the export; read recon_media fresh.
const media = [];
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db.from("recon_media").select("id,recon_entry_id,storage_path,thumb_path").in("recon_entry_id", ids.slice(i, i + 200));
  if (error) throw new Error(error.message);
  media.push(...data);
}

// Local harvested photos, by hash of BOTH the full file and the thumb.
const local = new Map();
const dataRoot = path.resolve(DIR, "..");
for (const top of ["enrichvendors", "enrichvenues"]) {
  const root = path.join(dataRoot, top);
  if (!fs.existsSync(root)) continue;
  for (const run of fs.readdirSync(root)) {
    const pdir = path.join(root, run, "photos");
    if (!fs.existsSync(pdir)) continue;
    for (const slug of fs.readdirSync(pdir)) {
      const sdir = path.join(pdir, slug);
      if (!fs.statSync(sdir).isDirectory()) continue;
      let manifest = [];
      try { manifest = JSON.parse(fs.readFileSync(path.join(sdir, "manifest.json"), "utf8")); } catch { /* no manifest */ }
      const byFile = new Map(manifest.map((m) => [m.file, m]));
      for (const f of fs.readdirSync(sdir)) {
        if (!/^\d+(_thumb)?\.jpg$/.test(f)) continue;
        const m = byFile.get(f.replace("_thumb", "")) ?? {};
        local.set(md5(fs.readFileSync(path.join(sdir, f))), {
          local: path.join(sdir, f.replace("_thumb", "")), run, slug,
          source_url: m.source_url ?? null, source_page: m.source_page ?? null, alt: m.alt ?? null,
        });
      }
    }
  }
}

// New-rule verdicts from a photos.mjs dry run, keyed by source image URL.
const rejectByUrl = new Map();
if (SEL && fs.existsSync(SEL)) {
  const walk = (d) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) walk(p);
      else if (n.name === "selection.json") {
        const s = JSON.parse(fs.readFileSync(p, "utf8"));
        for (const r of s.rejected ?? []) if (r.url) rejectByUrl.set(r.url, r.reason);
        if (s.skipped) for (const r of s.picked ?? []) if (r.url) rejectByUrl.set(r.url, `vendor skipped: ${s.skipped}`);
      }
    }
  };
  walk(SEL);
}

const outDir = path.join(DIR, "cleanup/photos");
fs.mkdirSync(outDir, { recursive: true });
const byEntry = new Map(entries.map((e) => [e.id, e]));
const rows = [];
let unmatched = 0;
for (const m of media) {
  const e = byEntry.get(m.recon_entry_id);
  const v = vendors.get(e.vendor_id);
  const key = m.thumb_path || m.storage_path;
  const { data, error } = await db.storage.from("recon-media").download(key);
  if (error) { console.error(`download ${key}: ${error.message}`); continue; }
  const buf = Buffer.from(await data.arrayBuffer());
  const n = path.basename(m.storage_path, ".jpg");
  fs.mkdirSync(path.join(outDir, e.id), { recursive: true });
  const file = path.join(outDir, e.id, `${n}.jpg`);
  fs.writeFileSync(file, buf);
  const hit = local.get(md5(buf));
  if (!hit) unmatched++;
  rows.push({
    entry_id: e.id, vendor_id: e.vendor_id, vendor_name: v?.name, vendor_type: v?.vendor_type, website: v?.website,
    media_id: m.id, storage_path: m.storage_path, thumb_path: m.thumb_path, file,
    local: hit?.local ?? null, source_url: hit?.source_url ?? null, source_page: hit?.source_page ?? null, alt: hit?.alt ?? null,
    new_rule_reject: hit?.source_url ? rejectByUrl.get(hit.source_url) ?? null : null,
  });
}
fs.writeFileSync(path.join(DIR, "cleanup/photos.json"), JSON.stringify(rows, null, 1));
console.log({ media: media.length, downloaded: rows.length, matchedLocal: rows.length - unmatched, unmatched, newRuleRejects: rows.filter((r) => r.new_rule_reject).length });
