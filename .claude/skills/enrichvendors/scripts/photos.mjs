// Phase-3 photos for /enrichvenues: download candidate images harvested per venue,
// keep the largest real photos (skips tiny/logo-ish files), and compress to the
// app's convention (~1600px full JPEG + ~400px thumb, mirroring lib/image-compress.ts).
// Writes photos/<slug>/NN.jpg + NN_thumb.jpg and photos/<slug>/manifest.json (source URLs).
// usage: node --env-file=.env.local .claude/skills/enrichvendors/scripts/photos.mjs <workdir> [--type photographer] [--per-venue 4]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sleep, argValue } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: photos.mjs <workdir> [--per-venue 4]'); process.exit(1); }
const PER_VENUE = parseInt(argValue('per-venue') || '3', 10);
const MIN_W = 700, MIN_H = 400;
// Pre-download junk filter: badges/awards/graphics always; couple-portrait tells only for
// types where people-as-subject is junk (venues). For photographers, portraits ARE the
// portfolio — profile.portraitFilter turns the second filter off.
const profile = etype();
const JUNK_URL = /logo|icon|favicon|badge|award|winner|diners|nextdoor|opentable|weddingwire|theknot|\bmenu\b|placeholder|coming-soon/i;
const PORTRAIT_URL = profile.portraitFilter
  ? /%20(&|and)%20|[-_](bride|groom|couple|engagement|portrait|elopement)[-_.]|first[-_]?look/i
  : /$^/; // matches nothing
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// CDN URLs often point at downsized renditions; ask for the original/larger one.
function upgradeUrl(u) {
  const wix = u.match(/^(https:\/\/static\.wixstatic\.com\/media\/[^/]+)\/v1\//);
  if (wix) return wix[1];
  if (/\bwidth=\d+/.test(u)) return u.replace(/\bwidth=\d+/, 'width=1600');
  return u;
}

const only = (argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean);
const researchDir = path.join(workdir, 'research');
for (const slug of fs.readdirSync(researchDir)) {
  if (only.length && !only.includes(slug)) continue;
  const hf = path.join(researchDir, slug, 'harvest.json');
  if (!fs.existsSync(hf)) continue;
  const h = JSON.parse(fs.readFileSync(hf, 'utf8'));
  const urls = [...new Set((h.images || []).map(upgradeUrl))]
    .filter((u) => !JUNK_URL.test(u) && !PORTRAIT_URL.test(decodeURIComponent(u)));
  if (!urls.length) { console.log(`${slug}: no image urls`); continue; }

  const outDir = path.join(workdir, 'photos', slug);
  fs.mkdirSync(outDir, { recursive: true });
  const candidates = [];
  for (const u of urls) {
    if (candidates.length >= PER_VENUE * 2) break; // fetch a few extra, keep the best
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: h.website || u }, signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < MIN_W || (meta.height ?? 0) < MIN_H) continue;
      candidates.push({ url: u, buf, area: meta.width * meta.height });
    } catch { /* skip broken urls */ }
    await sleep(150);
  }
  candidates.sort((a, b) => b.area - a.area);
  const picked = candidates.slice(0, PER_VENUE);
  const manifest = [];
  for (let i = 0; i < picked.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    await sharp(picked[i].buf).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 }).toFile(path.join(outDir, `${n}.jpg`));
    await sharp(picked[i].buf).rotate().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 }).toFile(path.join(outDir, `${n}_thumb.jpg`));
    manifest.push({ file: `${n}.jpg`, source_url: picked[i].url });
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${slug}: kept ${picked.length}/${urls.length} candidate urls`);
}
console.log(`\nphotos → ${path.join(workdir, 'photos')}/<slug>/NN.jpg (+_thumb)`);
