// Compress each harvested venue's research into ONE ~800-token dossier.md that a
// single-turn draft call reads inline. This is the v2 cost lever: agents never read
// raw harvest.json / page-*.txt / whole digests — a regex pass extracts the pricing,
// capacity, review, and reddit content for free, and everything else stays on disk.
// Pure filesystem: no DB, no network, no env needed.
// usage: node .claude/skills/enrichvendors/scripts/dossier.mjs <workdir> [--type photographer] [--venues "slug;slug"] [--cap 4000]
import fs from 'node:fs';
import path from 'node:path';
import { norm, argValue } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: dossier.mjs <workdir> [--venues "a;b"] [--cap 4000]'); process.exit(1); }
const CAP = parseInt(argValue('cap') || '4000', 10); // chars; ~= tokens*4
const only = new Set((argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean));

const researchDir = path.join(workdir, 'research');
const digests = fs.readdirSync(researchDir)
  .filter((f) => f.startsWith('pricing-web-') && f.endsWith('.txt'))
  .map((f) => ({ tag: f.replace(/^pricing-web-|\.txt$/g, ''), lines: fs.readFileSync(path.join(researchDir, f), 'utf8').split('\n') }));

const profile = etype();
const PRICE_LINE = profile.priceLine;
const NOISE = /cookie|privacy|subscribe|newsletter|copyright|all rights|follow us|instagram|facebook|menu toggle|skip to (content|main)|sign in|log in|gift card|careers/i;
const WEDDINGY = /wedding|recept|ceremon|bride|groom|married/i;
const nameKey = (s) => norm(s).replace(/\b(the|at|by|of|a)\b/g, ' ').replace(/\s+/g, ' ').trim();

let done = 0, withDollar = 0, totalChars = 0;
for (const slug of fs.readdirSync(researchDir).sort()) {
  const dir = path.join(researchDir, slug);
  if (!fs.existsSync(path.join(dir, 'harvest.json'))) continue;
  if (only.size && !only.has(slug)) continue;
  const h = JSON.parse(fs.readFileSync(path.join(dir, 'harvest.json'), 'utf8'));

  // 1) pricing/capacity lines from site text — pricing-ish pages first, then home
  const pageFiles = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.txt') && f !== 'reddit-slice.txt')
    .sort((a, b) => (/pric|packag|rate|invest|wedding|event|faq|rental/i.test(a) ? 0 : 1) - (/pric|packag|rate|invest|wedding|event|faq|rental/i.test(b) ? 0 : 1));
  const seen = new Set();
  const priceLines = [];
  let priceChars = 0;
  outer: for (const pf of pageFiles) {
    for (const raw of fs.readFileSync(path.join(dir, pf), 'utf8').split('\n')) {
      const line = raw.trim();
      if (line.length < 20 || line.length > 300) continue;
      if (!PRICE_LINE.test(line) || NOISE.test(line)) continue;
      const k = norm(line).slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      priceLines.push(line);
      priceChars += line.length;
      if (priceChars > 1500) break outer;
    }
  }

  // 2) top 3 reviews — wedding-relevant first, then longest; trimmed to 400 chars
  const revs = (h.google?.reviews || []).slice()
    .sort((a, b) => (WEDDINGY.test(b.text) ? 1 : 0) - (WEDDINGY.test(a.text) ? 1 : 0) || (b.text?.length || 0) - (a.text?.length || 0))
    .slice(0, 3)
    .map((r) => `- (${r.rating}★ ${r.when || ''}) ${r.text.replace(/\s+/g, ' ').slice(0, 400)}`);

  // 3) region-digest lines naming this venue
  const key = nameKey(h.name);
  const digestHits = [];
  if (key.length >= 5) {
    for (const d of digests) {
      for (const l of d.lines) {
        if (!nameKey(l).includes(key)) continue;
        digestHits.push(`- [${d.tag}] ${l.trim().slice(0, 300)}`);
        if (digestHits.length >= 4) break;
      }
      if (digestHits.length >= 4) break;
    }
  }

  // 4) reddit slice (already pre-cut) + pdf pointers (not fetched — honesty hint only)
  const rs = path.join(dir, 'reddit-slice.txt');
  const reddit = fs.existsSync(rs) ? fs.readFileSync(rs, 'utf8').trim().slice(0, 900) : '';
  const pdfs = (h.pdfs || []).slice(0, 2);

  const parts = [
    `# ${h.name} (${h.city || '?'}) — vendor_id=${h.vendor_id}`,
    `site=${h.website || h.google?.websiteUri || 'none'}${h.instagram ? ` | instagram=@${h.instagram}` : ''} | google ${h.google?.rating ?? '?'}★ × ${h.google?.ratingCount ?? '?'}${h.site_error ? ` | SITE CRAWL FAILED (${h.site_error})` : ''}`,
    h.google?.summary ? `google summary: ${h.google.summary}` : '',
    `\n## ${profile.dossierPriceTitle}\n${priceLines.length ? priceLines.join('\n') : '(none found on site)'}`,
    pdfs.length ? `pdf rate cards seen on site (not fetched): ${pdfs.join(' ; ')}` : '',
    revs.length ? `\n## google reviews (top ${revs.length})\n${revs.join('\n')}` : '',
    digestHits.length ? `\n## region pricing digests\n${digestHits.join('\n')}` : '',
    reddit ? `\n## reddit\n${reddit}` : '',
  ].filter(Boolean);
  let text = parts.join('\n');
  if (text.length > CAP) text = text.slice(0, CAP) + '\n[truncated]';
  fs.writeFileSync(path.join(dir, 'dossier.md'), text + '\n');
  done++;
  if (/\$\s?\d/.test(text)) withDollar++;
  totalChars += text.length;
}
console.log(`dossiers written: ${done} | containing $ figures: ${withDollar} | avg ~${Math.round(totalChars / Math.max(done, 1) / 4)} tokens each`);
