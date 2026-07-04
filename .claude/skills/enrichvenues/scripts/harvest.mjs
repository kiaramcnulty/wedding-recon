// Phase-1 harvest for /enrichvenues: for each target venue, pull Google Places
// details (rating + up to 5 reviews) and crawl the venue website (homepage +
// pricing/wedding subpages) for text, image URLs, and PDF links.
// Writes research/<slug>/harvest.json under the workdir. Read-only against Supabase.
// usage: node --env-file=.env.local .claude/skills/enrichvenues/scripts/harvest.mjs <workdir> --region CO [--venues "Name 1;Name 2"] [--limit N]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { norm, sleep, argValue } from '../../launchvenues/scripts/lib.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: harvest.mjs <workdir> --region CO [--venues "a;b"] [--limit N]'); process.exit(1); }
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLACES_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}

const region = argValue('region') || 'CO';
const wanted = (argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean);
const limit = parseInt(argValue('limit') || '0', 10);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: all, error } = await supabase
  .from('vendors')
  .select('id, name, city, region, website, google_place_id')
  .eq('vendor_type', 'venue').eq('region', region);
if (error) { console.error('DB read failed:', error.message); process.exit(1); }

let targets = all;
if (wanted.length) {
  targets = wanted.map((w) => all.find((v) => norm(v.name) === norm(w)) || all.find((v) => norm(v.name).includes(norm(w))))
    .filter(Boolean);
  const missed = wanted.filter((w) => !all.some((v) => norm(v.name) === norm(w) || norm(v.name).includes(norm(w))));
  if (missed.length) console.error(`NOT FOUND in DB (skipped): ${missed.join('; ')}`);
}
if (limit) targets = targets.slice(0, limit);

const slug = (s) => norm(s).replace(/ /g, '-').slice(0, 60);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function get(url, accept = 'text/html') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: ctl.signal });
    if (!res.ok) return { err: `HTTP ${res.status}` };
    return { text: await res.text(), finalUrl: res.url };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(t); }
}

const stripTags = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*/g, '\n').trim();

const abs = (href, base) => { try { return new URL(href, base).href; } catch { return null; } };

function extractLinks(html, base) {
  const links = new Set();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) { const u = abs(m[1], base); if (u) links.add(u); }
  return [...links];
}

function extractImages(html, base) {
  const imgs = new Set();
  for (const m of html.matchAll(/(?:og:image["'][^>]*content|content=["'][^"']*["'][^>]*og:image)["']?\s*=?\s*["']?([^"'>\s]+)/gi)) { const u = abs(m[1], base); if (u) imgs.add(u); }
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) { const u = abs(m[1], base); if (u) imgs.add(u); }
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)) { const u = abs(m[1], base); if (u) imgs.add(u); }
  return [...imgs].filter((u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u) && !/logo|icon|favicon|sprite|badge|avatar|arrow|\.svg/i.test(u));
}

async function placeDetails(pid) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${pid}`, {
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,editorialSummary,websiteUri,reviews',
    },
  });
  if (!res.ok) return { err: `Places ${res.status}` };
  const d = await res.json();
  return {
    rating: d.rating, ratingCount: d.userRatingCount,
    summary: d.editorialSummary?.text,
    websiteUri: d.websiteUri,
    reviews: (d.reviews || []).map((r) => ({
      rating: r.rating,
      // publishTime is sometimes absent; the relative description ("8 months ago") still anchors dates
      when: r.publishTime?.slice(0, 7) || r.relativePublishTimeDescription,
      text: (r.text?.text || r.originalText?.text || '').trim(),
    })).filter((r) => r.text),
  };
}

const SUBPAGE = /(pric|package|rate|invest|wedding|event|faq|rental|tour|book|venue|capacit)/i;

fs.mkdirSync(path.join(workdir, 'research'), { recursive: true });
let ok = 0, failed = 0;
for (const v of targets) {
  const dir = path.join(workdir, 'research', slug(v.name));
  fs.mkdirSync(dir, { recursive: true });
  const out = { vendor_id: v.id, name: v.name, city: v.city, website: v.website, place_id: v.google_place_id, fetched_at: new Date().toISOString() };

  if (v.google_place_id) { out.google = await placeDetails(v.google_place_id); await sleep(150); }
  const site = v.website || out.google?.websiteUri;
  if (site) {
    const home = await get(site);
    if (home.err) out.site_error = home.err;
    else {
      const base = home.finalUrl || site;
      const host = new URL(base).host.replace(/^www\./, '');
      const subs = extractLinks(home.text, base)
        .filter((u) => { try { return new URL(u).host.replace(/^www\./, '') === host && SUBPAGE.test(new URL(u).pathname); } catch { return false; } })
        .filter((u) => !/\.(jpe?g|png|webp|css|js|ics)(\?|$)/i.test(u))
        .filter((u) => !/wp-json|tribe-events|\/feed\b|calendar|\bevent\b.*\d{4}/i.test(u)) // calendar/API dumps waste tokens
        .slice(0, 5);
      out.pdfs = extractLinks(home.text, base).filter((u) => /\.pdf(\?|$)/i.test(u)).slice(0, 5);
      out.images = extractImages(home.text, base);
      out.pages = [{ url: base, kind: 'home' }];
      fs.writeFileSync(path.join(dir, 'home.txt'), stripTags(home.text));
      for (const u of subs) {
        const p = await get(u);
        if (p.err) { out.pages.push({ url: u, error: p.err }); continue; }
        const fname = 'page-' + slug(new URL(u).pathname).slice(0, 40) + '.txt';
        fs.writeFileSync(path.join(dir, fname), stripTags(p.text));
        out.images.push(...extractImages(p.text, u));
        out.pdfs.push(...extractLinks(p.text, u).filter((x) => /\.pdf(\?|$)/i.test(x)));
        out.pages.push({ url: u, file: fname });
        await sleep(300);
      }
      out.images = [...new Set(out.images)].slice(0, 40);
      out.pdfs = [...new Set(out.pdfs)].slice(0, 8);
    }
  }
  fs.writeFileSync(path.join(dir, 'harvest.json'), JSON.stringify(out, null, 2));
  const g = out.google ? `${out.google.reviews?.length ?? 0} reviews (${out.google.rating}★/${out.google.ratingCount})` : 'no place';
  const s = out.site_error ? `site FAIL: ${out.site_error}` : site ? `${(out.pages?.length ?? 1) - 1} subpages, ${out.images?.length ?? 0} imgs, ${out.pdfs?.length ?? 0} pdfs` : 'no website';
  console.log(`${v.name} — ${g} | ${s}`);
  out.site_error || (!site && !v.google_place_id) ? failed++ : ok++;
}
console.log(`\nharvested ${targets.length} venues → ${path.join(workdir, 'research')}/<slug>/harvest.json`);
