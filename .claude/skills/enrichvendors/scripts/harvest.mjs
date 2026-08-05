// Phase-1 harvest for /enrichvenues: for each target venue, pull Google Places
// details (rating + up to 5 reviews) and crawl the venue website (homepage +
// pricing/wedding subpages) for text, image URLs, and PDF links.
// Writes research/<slug>/harvest.json under the workdir. Read-only against Supabase.
//
// RESUMABLE: a venue whose harvest.json already holds a clean Google block is skipped.
// The Places call here carries `reviews`, which bills at Place Details
// Enterprise+Atmosphere ($25/1k, only 1,000 free a month) — the priciest SKU we touch, and
// one per venue. Re-running harvest to pick up newly-seeded venues, a widened subpage
// regex, or a crashed run used to re-pay for the whole region. Use --refresh to force.
// usage: node --env-file=.env.local .claude/skills/enrichvendors/scripts/harvest.mjs <workdir> --region CO [--type photographer] [--venues "Name 1;Name 2"] [--limit N] [--refresh]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { norm, sleep, argValue, selectAll, placesSpendReport, placeDetails as libPlaceDetails } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';
import { pdfText, looksLikeText } from './pdf-text.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: harvest.mjs <workdir> --region CO [--venues "a;b"] [--limit N]'); process.exit(1); }
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLACES_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}

const region = argValue('region') || 'CO';
const wanted = (argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean);
const limit = parseInt(argValue('limit') || '0', 10);
const sitesOnly = process.argv.includes('--sites-only');
const REFRESH = process.argv.includes('--refresh');   // re-fetch venues that already have a clean dossier

const profile = etype();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: all, error } = await selectAll(() => supabase
  .from('vendors')
  .select(`id, name, city, region, website, google_place_id${profile.hasInstagram ? ', instagram' : ''}`)
  // Split types (music → dj|band) harvest across all their vendor_types in one run.
  .in('vendor_type', profile.vendorTypes ?? [profile.vendorType]).eq('region', region).order('name'));
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

// Generous, because parse cost is no longer the constraint: pdf-text.mjs skips image
// streams by dictionary before inflating, so a 48MB brochure parses in 0.03s. What this
// actually guards is memory (the parser holds a latin1 copy of the buffer) — the real
// limiter on big files is the 45s download deadline below, which is the honest cost.
// Files that are large AND slow get cut off; large-but-fast ones are now read.
const PDF_MAX_BYTES = 40 * 1024 * 1024;

/**
 * Fetch a PDF, with a HEAD preflight.
 *
 * The preflight is the whole trick. Measured across the CO corpus, 72 of 323 linked PDFs
 * are >4MB and 27 are >12MB (one is 97MB) — photo brochures, not rate cards. Downloading
 * blind meant the oversized ones burned the full timeout and then got discarded anyway,
 * while genuinely useful 4-12MB files timed out behind them. Asking for the size first
 * costs one cheap request: oversized files are skipped instantly, and everything we do
 * download gets a deadline generous enough to actually finish.
 *
 * A Referer is sent because some CDNs 403 a bare request for an asset.
 */
async function getBytes(url, referer) {
  const headers = { 'User-Agent': UA, Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8', ...(referer ? { Referer: referer } : {}) };
  // Preflight; a host that rejects HEAD just falls through to the GET.
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    try {
      const h = await fetch(url, { method: 'HEAD', headers, redirect: 'follow', signal: ctl.signal });
      const len = parseInt(h.headers.get('content-length') || '0', 10);
      if (h.ok && len > PDF_MAX_BYTES) return { err: `too large (${(len / 1048576).toFixed(0)}MB)` };
      const ct = h.headers.get('content-type') || '';
      if (h.ok && ct && !/pdf|octet-stream/i.test(ct)) return { err: `not a pdf (${ct.slice(0, 40)})` };
    } finally { clearTimeout(t); }
  } catch { /* preflight is best-effort */ }

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: ctl.signal });
    if (!res.ok) return { err: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    // Guard against a soft-404 that serves an HTML error page with a 200.
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return { err: 'not a pdf (bad magic)' };
    if (buf.length > PDF_MAX_BYTES) return { err: `too large (${(buf.length / 1048576).toFixed(0)}MB)` };
    return { buf };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(t); }
}

// How useful a URL looks for the attributes the Explore filters need. Used to RANK
// subpages and PDFs rather than taking whichever the page happened to link first —
// before this, an "about" page could crowd out the pricing page inside the crawl budget.
const FILTER_HINTS = [
  [/(pricing|rate-?card|rates|invest|package|cost|fee)/i, 5],
  [/(capacit|seating|floor-?plan|space|venue-?detail)/i, 4],
  [/(wedding|bridal|elope|micro)/i, 3],
  [/(faq|policy|policies|includ|what-?s-?included)/i, 3],
  [/(cater|menu|bar|beverage|alcohol|dietary)/i, 3],
  [/(lodging|accommodat|stay|room|suite|shuttle|parking|breakfast)/i, 2],
  [/(service|collection|experience|tier)/i, 2],
];
const filterScore = (u) => FILTER_HINTS.reduce((s, [re, w]) => s + (re.test(u) ? w : 0), 0);

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

// Billed at Place Details Enterprise+Atmosphere ($25/1k) because of `reviews` — every
// other field here rides along free, so the mask is as wide as it is useful. Routed
// through lib.mjs's placeDetails so the run reports what it spent.
const DETAILS_MASK = 'id,displayName,rating,userRatingCount,editorialSummary,websiteUri,reviews';

async function placeDetails(pid) {
  // try/catch: a transient DNS/network blip must fail THIS venue, not kill the run
  let d;
  try { d = await libPlaceDetails(pid, DETAILS_MASK); }
  catch (e) { return { err: e.cause?.code || e.message || 'fetch failed' }; }
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

const SUBPAGE = profile.subpage;

fs.mkdirSync(path.join(workdir, 'research'), { recursive: true });
/**
 * True when this venue was already harvested cleanly and must not be re-fetched.
 *
 * "Cleanly" deliberately excludes a venue whose Google block carries an `err` — a failed
 * $25/1k call is worth retrying, a successful one is not. A venue with no place_id has no
 * Google block to judge, so an existing dossier is enough. `--refresh` overrides.
 */
function alreadyHarvested(v, dir) {
  if (REFRESH) return false;
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(dir, 'harvest.json'), 'utf8'));
    if (!v.google_place_id) return true;
    return !!prev.google && !prev.google.err;
  } catch { return false; }
}

let ok = 0, failed = 0, skipped = 0;

// Vendors are harvested CONCURRENTLY. Sequentially this is ~10s each, which is ~6 hours
// for a full multi-type region and effectively rules out re-crawling an existing market.
// Each vendor is an independent unit of work touching only its own directory, and the
// per-request sleeps below still pace requests to any single host, so a small pool is
// safe. --concurrency overrides; keep it modest to stay polite to shared hosts.
const CONCURRENCY = Math.max(1, parseInt(argValue('concurrency') || '6', 10));

async function harvestOne(v) {
  const dir = path.join(workdir, 'research', slug(v.name));
  fs.mkdirSync(dir, { recursive: true });
  if (alreadyHarvested(v, dir)) { skipped++; return; }   // `return`, not `continue`: this is a function body now
  const out = { vendor_id: v.id, name: v.name, city: v.city, website: v.website, place_id: v.google_place_id, instagram: v.instagram || undefined, fetched_at: new Date().toISOString() };

  // --sites-only re-crawls websites WITHOUT re-billing Google Places. Use it when the
  // reviews/rating on file are fine and you only want better site coverage (e.g. a
  // filter-attribute pass over an already-harvested region). Existing google data is
  // preserved from the previous harvest.json rather than dropped.
  if (v.google_place_id && !sitesOnly) { out.google = await placeDetails(v.google_place_id); await sleep(150); }
  else if (sitesOnly) {
    try { out.google = JSON.parse(fs.readFileSync(path.join(dir, 'harvest.json'), 'utf8')).google; } catch { /* first run */ }
  }
  const site = v.website || out.google?.websiteUri;
  if (site) {
    const home = await get(site);
    if (home.err) out.site_error = home.err;
    else {
      const base = home.finalUrl || site;
      const host = new URL(base).host.replace(/^www\./, '');
      // Candidate pages are RANKED, never excluded by URL pattern.
      //
      // This used to gate on `SUBPAGE.test(pathname)`, so a page whose URL didn't match a
      // hand-written pattern was never fetched no matter what it contained. That's the
      // same failure that made regex untrustworthy everywhere else in this pipeline: a
      // pattern deciding a fact is absent. Pinecrest's `/about-1` page — capacity 225, a
      // prep kitchen "for your caterer", a bar station and a groom's lounge — is exactly
      // the page such a filter drops. Rank by relevance, take the top N, and let the
      // model judge the contents.
      const subs = extractLinks(home.text, base)
        .filter((u) => { try { return new URL(u).host.replace(/^www\./, '') === host; } catch { return false; } })
        .filter((u) => !/\.(jpe?g|png|webp|css|js|ics|zip|mp4)(\?|$)/i.test(u))
        .filter((u) => !/wp-json|tribe-events|\/feed\b|calendar|\bevent\b.*\d{4}|\/(tag|author|page)\/\d/i.test(u)) // API/calendar dumps waste tokens
        // SUBPAGE still counts, as a strong ranking hint rather than a gate.
        .sort((a, b) => (filterScore(b) + (SUBPAGE.test(b) ? 4 : 0)) - (filterScore(a) + (SUBPAGE.test(a) ? 4 : 0)))
        .slice(0, 8);
      out.pdfs = extractLinks(home.text, base).filter((u) => /\.pdf(\?|$)/i.test(u)).slice(0, 8);
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
      out.pdfs = [...new Set(out.pdfs)].sort((a, b) => filterScore(b) - filterScore(a)).slice(0, 8);

      // Fetch the most promising PDFs. Vendors very often publish the rate card ONLY as a
      // PDF; this harvest used to record the link and stop, leaving a hole in the corpus
      // exactly where pricing lives (112/679 CO venues, 24 explicitly pricing-named).
      // Extraction fails cleanly on scans and on ambiguous CID fonts — see pdf-text.mjs.
      out.pdf_texts = [];
      // Take the top 3 by rank WITHOUT requiring a positive score: Squarespace and Wix
      // serve PDFs under opaque hash filenames ("8ecfd3_c33011dc….pdf"), which score 0
      // and would be skipped entirely — yet San Sophia Overlook's pricing lived in
      // exactly such a file. An unrankable name is unknown, not irrelevant.
      for (const u of out.pdfs.slice(0, 3)) {
        const r = await getBytes(u, base);
        if (r.err) { out.pdf_texts.push({ url: u, error: r.err }); continue; }
        let txt = '';
        try { txt = pdfText(r.buf); } catch (e) { out.pdf_texts.push({ url: u, error: `parse: ${e.message}` }); continue; }
        if (!looksLikeText(txt)) {
          // Distinguish "we failed" from "no pricing" — the dossier must never let a
          // scanned rate card read as a vendor that doesn't publish prices.
          out.pdf_texts.push({ url: u, error: 'no extractable text (scanned or ambiguous fonts)' });
          continue;
        }
        const fname = 'pdf-' + slug(new URL(u).pathname.split('/').pop().replace(/\.pdf$/i, '')).slice(0, 40) + '.txt';
        fs.writeFileSync(path.join(dir, fname), txt.slice(0, 60000));
        out.pdf_texts.push({ url: u, file: fname, chars: txt.length });
        await sleep(300);
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'harvest.json'), JSON.stringify(out, null, 2));
  const g = out.google ? `${out.google.reviews?.length ?? 0} reviews (${out.google.rating}★/${out.google.ratingCount})` : 'no place';
  const pdfOk = (out.pdf_texts || []).filter((p) => p.file).length;
  const pdfTried = (out.pdf_texts || []).length;
  const s = out.site_error ? `site FAIL: ${out.site_error}`
    : site ? `${(out.pages?.length ?? 1) - 1} subpages, ${out.images?.length ?? 0} imgs, ${out.pdfs?.length ?? 0} pdfs${pdfTried ? ` (read ${pdfOk}/${pdfTried})` : ''}` : 'no website';
  console.log(`${v.name} — ${g} | ${s}`);
  out.site_error || (!site && !v.google_place_id) ? failed++ : ok++;
}

const queue = [...targets];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const v = queue.shift();
    // One vendor's failure must never abort the pool.
    try { await harvestOne(v); } catch (e) { failed++; console.log(`${v.name} — ERROR ${e.message}`); }
  }
}));
console.log(`\nharvested ${ok + failed} vendors (${ok} ok, ${failed} failed)${skipped ? ` | ${skipped} already on file (--refresh to re-fetch)` : ''} → ${path.join(workdir, 'research')}/<slug>/harvest.json`);
console.log(placesSpendReport());
