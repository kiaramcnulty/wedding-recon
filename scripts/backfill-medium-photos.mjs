#!/usr/bin/env node
/**
 * Backfill the ~600px "medium" photo variant (migration 0053) for photos that
 * were uploaded before it existed: recon_media rows (couples and bots) and
 * verified vendors' listing photos (vendor_listings.photos, jsonb).
 *
 *   node scripts/backfill-medium-photos.mjs                    dry run: counts + cost
 *   node scripts/backfill-medium-photos.mjs --apply            write everything
 *   node scripts/backfill-medium-photos.mjs --apply --limit 20 write the first 20
 *
 * For each photo: download the full (1600px) from Storage, resize it to 600px on
 * the long edge at JPEG quality 72 (the size the app and the bot upload write),
 * upload it beside the full, then record medium_path. Resume-safe: only photos
 * with no medium_path are picked, and uploads upsert, so a re-run after a
 * failure finishes the rest.
 *
 * Cost: one full download per photo (Supabase egress; 183 KB average across 200
 * bot photos) and one ~36 KB upload (storage). The dry run prints both totals
 * from that average, before anything is fetched.
 *
 * The vendor page is cached for an hour (ISR) and this script does not expire
 * it, so a backfilled photo shows its medium once the page next re-renders.
 * Requires migration 0053; the first query fails clearly without it.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Number(args[i + 1]) : Infinity;
})();
const CONCURRENCY = 4;

// Measured averages (2026-11-28, 200 bot photos), for the dry-run estimate only.
const AVG_FULL_KB = 183;
const AVG_MEDIUM_KB = 36;

/** Same size and quality as MEDIUM in lib/recon-upload.ts and the bot upload. */
const toMedium = (buf) =>
  sharp(buf)
    .rotate()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();

/**
 * Where a photo's medium goes, beside its full: the app names fulls
 * `<n>-full.jpg` (medium `<n>-medium.jpg`), the bot upload names them
 * `photo-<n>.jpg` (medium `photo-<n>_medium.jpg`, as upload.mjs now writes).
 */
export function mediumPathFor(storagePath) {
  if (/-full\.jpe?g$/i.test(storagePath)) return storagePath.replace(/-full\.jpe?g$/i, "-medium.jpg");
  return storagePath.replace(/\.[a-z0-9]+$/i, "") + "_medium.jpg";
}

function connect() {
  // The environment wins; .env.local is read only for what it does not set.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Every row, 1000 at a time: PostgREST caps a single select at 1000. */
async function selectAll(make) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Download a full, make and upload its medium; returns the medium path. */
async function makeMedium(supabase, bucket, storagePath) {
  const { data: blob, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !blob) throw new Error(`download ${bucket}/${storagePath}: ${error?.message ?? "empty"}`);
  const medium = await toMedium(Buffer.from(await blob.arrayBuffer()));
  const path = mediumPathFor(storagePath);
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, medium, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw new Error(`upload ${bucket}/${path}: ${upErr.message}`);
  return { path, bytes: medium.length };
}

async function inBatches(items, fn) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(fn));
  }
}

async function main() {
  const supabase = connect();

  const media = (
    await selectAll(() =>
      supabase
        .from("recon_media")
        .select("id, storage_path")
        .is("medium_path", null)
        .order("id"),
    )
  ).slice(0, LIMIT);

  const listings = (
    await selectAll(() => supabase.from("vendor_listings").select("vendor_id, photos").order("vendor_id"))
  ).filter((l) => (l.photos ?? []).some((p) => !p.medium_path));
  const listingPhotos = listings.reduce(
    (n, l) => n + l.photos.filter((p) => !p.medium_path).length,
    0,
  );

  const total = media.length + listingPhotos;
  console.log(`recon_media rows without a medium: ${media.length}${LIMIT < Infinity ? ` (limited to ${LIMIT})` : ""}`);
  console.log(`listing photos without a medium:   ${listingPhotos} across ${listings.length} listings`);
  console.log(
    `estimate: ~${((total * AVG_FULL_KB) / 1024).toFixed(0)} MB downloaded (egress), ` +
      `~${((total * AVG_MEDIUM_KB) / 1024).toFixed(0)} MB added to storage`,
  );
  if (!APPLY) {
    console.log("\nDry run: nothing fetched or written. Re-run with --apply.");
    return;
  }

  let done = 0;
  let bytes = 0;
  const failures = [];

  await inBatches(media, async (row) => {
    try {
      const m = await makeMedium(supabase, "recon-media", row.storage_path);
      const { error } = await supabase.from("recon_media").update({ medium_path: m.path }).eq("id", row.id);
      if (error) throw new Error(`update recon_media ${row.id}: ${error.message}`);
      bytes += m.bytes;
      if (++done % 100 === 0) console.log(`  ${done} / ${total}`);
    } catch (e) {
      failures.push(e.message);
    }
  });

  // Listings: every photo of one listing first, then one write of its array, so
  // a failure part way leaves the row as it was rather than half-updated.
  for (const l of listings) {
    try {
      const photos = [];
      for (const p of l.photos) {
        if (p.medium_path) {
          photos.push(p);
          continue;
        }
        const m = await makeMedium(supabase, "vendor-media", p.storage_path);
        bytes += m.bytes;
        done++;
        photos.push({ ...p, medium_path: m.path });
      }
      const { error } = await supabase.from("vendor_listings").update({ photos }).eq("vendor_id", l.vendor_id);
      if (error) throw new Error(`update vendor_listings ${l.vendor_id}: ${error.message}`);
    } catch (e) {
      failures.push(e.message);
    }
  }

  console.log(`\nwrote ${done} mediums, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (failures.length) {
    console.log(`${failures.length} failed (left without a medium; a re-run retries them):`);
    for (const f of failures.slice(0, 50)) console.log(`  ${f}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
