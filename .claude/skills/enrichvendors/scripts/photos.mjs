// Phase-3 photos for /enrichvenues: download candidate images harvested per venue,
// keep the largest real photos (skips tiny/logo-ish files), and compress to the
// app's convention (~1600px full JPEG + ~400px thumb, mirroring lib/image-compress.ts).
// Writes photos/<slug>/NN.jpg + NN_thumb.jpg, photos/<slug>/manifest.json (per-photo
// provenance) and photos/<slug>/selection.json (every rejected candidate + its reason).
// usage: node --env-file=.env.local .claude/skills/enrichvendors/scripts/photos.mjs <workdir> [--type photographer] [--per-venue 4]
//        [--venues "slug-a;slug-b"] [--out <dir>] [--dry-run]
//   --out      write photos/<slug>/... under <dir> instead of <workdir> (harvests are still read from <workdir>)
//   --dry-run  no downloads, no image files: print the ranked picks + rejects, and write
//              selection.json only when --out is given (so a dry run never touches the workdir)
//
// SELECTION (2026-10 bot-recon audit, plan item 10). The test is Kiara's (2026-10-02): does
// the photo PURPORT TO SHOW THIS VENDOR OR ITS WORK. A guest's shot of a venue is fine; a
// stock bride on a photographer's card, another act on a band's card, a headshot passed off
// as portfolio, or a different business's property are not. This pass used to take every
// image on the crawled site, ranked by pixel area, and shipped: four iStock-style template
// couples on Emberlight Media, an iStock gown on d'Anelli Bridal, two other bands from the
// shared booking-agency site on Groove Nation Orchestra, and a "headshots" file on Sierra
// Sturt. The rules below are deterministic URL/filename/page checks -- no model, no extra
// fetches -- and every reject is logged with a reason so the screener/reviewer can audit.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sleep, argValue, sigTokens } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: photos.mjs <workdir> [--per-venue 4] [--out <dir>] [--dry-run]'); process.exit(1); }
const PER_VENUE = parseInt(argValue('per-venue') || '3', 10);
const DRY = process.argv.includes('--dry-run');
const OUT = argValue('out') || (DRY ? null : workdir);
const MIN_W = 700, MIN_H = 400;
// Pre-download junk filter: badges/awards/graphics always; couple-portrait tells only for
// types where people-as-subject is junk (venues). For photographers, portraits ARE the
// portfolio — profile.portraitFilter turns the second filter off.
const profile = etype();
// `lgo` is d'Anelli's CMS abbreviation for its logo files. Screenshots are NOT rejected here:
// across the CO corpus they are mostly the vendor's own gowns/arrangements screenshotted from
// Instagram (Little White Dress, Mary & Martha's), which is the screener's call, not a URL rule.
const JUNK_URL = /logo|\blgo\b|icon|favicon|badge|award|winner|diners|nextdoor|opentable|weddingwire|theknot|\bmenu\b|placeholder|coming-soon/i;
const PORTRAIT_URL = profile.portraitFilter
  ? /%20(&|and)%20|[-_](bride|groom|couple|engagement|portrait|elopement)[-_.]|first[-_]?look/i
  : /$^/; // matches nothing
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// ---- stock ------------------------------------------------------------------------------
// Stock libraries by host OR by the filename they hand out. Site builders re-host stock under
// their own CDN, so the host alone misses most of it: d'Anelli's "iStock-1054969908" sits on
// lirp.cdn-website.com, Squarespace's built-in picker names files "unsplash-image-<id>"
// (3 hair & makeup vendors shipped those), and Beauty Bar Inc shipped "AdobeStock_419947244".
const STOCK_HOST = /(^|\.)(istockphoto|shutterstock|gettyimages|stock\.adobe|depositphotos|123rf|dreamstime|unsplash|pexels|pixabay|envato(usercontent)?|freepik|stocksy|bigstockphoto|canva|rawpixel)\.(com|net|io)$/i;
const STOCK_PATH = /istock|shutterstock|getty-?images|adobe-?stock|depositphotos|\b123rf\b|dreamstime|unsplash|pexels|pixabay|envato|freepik|stocksy|bigstock|rawpixel/i;
// Theme/template demo assets: images that ship INSIDE a theme or a demo import, not uploads.
// `%7Bwidth%7D` is an unfilled Shopify size template ("..._{width}x.jpg"), never a real file.
const TEMPLATE_PATH = /%7Bwidth%7D|\{width\}|\/wp-content\/themes\/|\/demo[s]?\/|\/demo-?content\/|themeforest|template-?kit|\/starter-?templates?\/|sample-?image|dummy/i;
// Watermark/proof hints in the name: a stock comp or a proof the vendor never licensed.
const WATERMARK = /watermark|\bwm\b|\bcomp\b|\bproof\b/i;
// Stock-catalog filenames read like a caption sentence: "gorgeous-bride-and-stylish-groom-
// walking-under-umbrella-in-rainy-street-and-smiling". A vendor's SEO name reads like a
// keyword list ("aley-doug-wedgewood-mountain-view-ranch-colorado-wedding-photographer"), so
// length alone is not the tell -- descriptive adjectives plus caption grammar (verbs in -ing,
// prepositions) are. Needs >= 6 words, >= 1 stock adjective, and >= 3 caption words in all.
const STOCK_ADJ = new Set(['gorgeous', 'stylish', 'beautiful', 'attractive', 'happy', 'young', 'elegant', 'romantic', 'lovely', 'cheerful', 'joyful', 'tender', 'sensual', 'smiling', 'laughing', 'loving', 'charming', 'pretty', 'handsome', 'rustic', 'adorable', 'luxurious']);
const STOCK_CAPTION = new Set(['in', 'at', 'with', 'under', 'on', 'near', 'against', 'through', 'over', 'outdoors', 'background', 'concept', 'isolated', 'closeup', 'woman', 'man', 'people', 'newlyweds', 'just', 'married', 'gently', 'showing', 'holding', 'embracing', 'hugging', 'walking', 'standing', 'sitting', 'looking', 'kissing', 'dancing', 'posing']);
function stockCaption(name) {
  const words = name.toLowerCase().replace(/[-_]?\d+x\d+$/, '').split(/[^a-z]+/).filter(Boolean);
  if (words.length < 6) return false;
  const adj = words.filter((w) => STOCK_ADJ.has(w)).length;
  const cap = words.filter((w) => STOCK_CAPTION.has(w)).length;
  return adj >= 1 && adj + cap >= 3;
}

// ---- people who are not the work ---------------------------------------------------------
// Every type's photo-rules.md lists staff/owner portraits as ALWAYS DROP (for photographers
// and planners: "the photographer's self-portrait/headshot"), so this applies to all types.
// For a photographer, "headshots" is also a non-wedding session -- a drop either way.
// "about-us"/"aboutme" in a FILENAME only demotes (pageTier): Alive Studios names its portfolio
// category tiles "About-Us-Weddings", "About-Us-Portraiture".
const PERSON_NOT_WORK = /head-?shots?|\b(team|staff|owner|founder|bio|profile|avatar|selfie)\b|meet-?(the-?)?(team|artist|owner|photographer|planner)|our-?team/i;
const ABOUT_FILE = /about-?(me|us)|our-?story/i;

// ---- page provenance ----------------------------------------------------------------------
// Ranks where an image was FOUND. Same pattern harvest.mjs uses to fetch a gallery page.
const GALLERY_PAGE = /(gallery|galleries|portfolio|real-?weddings?|\/weddings?\/?$|\/our-?work|lookbook|\/work\/?$)/i;
const ABOUT_PAGE = /(about|team|staff|meet|\bbio\b|contact|our-?story|who-?we-?are|founder|careers?|press)/i;
// A roster parent: the listing segment under which an agency/booking site gives each act or
// vendor its own page (celebrationnationentertainment.com/bands/<act>/).
// Booking/listing platforms: a vendor's page there sits among the platform's own marketing
// pages (vagaro.com/colorcrew next to vagaro.com/pro/...), whose images are never the vendor's.
const PLATFORM_HOST = /(^|\.)(vagaro|facebook|instagram|yelp|square|squareup|order|linktr|booksy|styleseat|glossgenius|weddingwire|theknot|zola|gigsalad|thebash|eventective|peerspace|vrbo|airbnb|vacasa|expireddomains)\./i;
const ROSTER_PARENT = /^\/(bands?|artists?|acts?|djs?|talent|roster|entertainers?|performers?|musicians?|ensembles?|vendors?|photographers?|planners?|stylists?|members?)\//i;

const compact = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pathOf = (u) => { try { return new URL(u).pathname; } catch { return ''; } };
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const fileOf = (u) => decodeURIComponent(pathOf(u).split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
// Trade words never identify WHICH vendor a page or file is about ("orchestra", "photo").
const TRADE = /^(photo\w*|films?|media|studios?|bridal|bride|boutique|salon|beauty|hair|makeup|floral|florals?|flowers?|florist|design|designs|catering|cater\w*|kitchen|band|orchestra|music|entertainment|dj|djs|sound|events?|planning|planner|coordinat\w*|weddings?|hotel|inn|lodge|resort|suites?|colorado|denver|special|occasion|company|group|collective|productions?|creative)$/;
const nameTokens = (name) => sigTokens(name).filter((t) => !TRADE.test(t));

/**
 * Is this vendor's website one page on someone else's multi-vendor site?
 *
 * Two signals, and the DOMAIN not matching the name is required for both: a vendor on its own
 * domain with a deep website URL (sierrasturt.com/all) is still its own site. Domain match is
 * "the host contains the vendor's FIRST distinctive token" -- not any token, because the agency
 * celebrationNATIONentertainment.com shares "nation" with Groove NATION Orchestra.
 *   (a) the website URL itself is a subpath (the vendor's page on the agency site), or
 *   (b) the crawl reached 2+ sibling pages under a roster parent (/bands/a/, /bands/b/).
 */
function siteContext(h) {
  const toks = nameTokens(h.name);
  const site = h.pages?.[0]?.url || h.website || '';
  const host = compact(hostOf(site).split('.').slice(0, -1).join(''));
  // Initials count when the host STARTS with them: gp-bridal.com is Guillermo Pharis Bridal.
  const initials = toks.length >= 2 ? toks.map((t) => t[0]).join('') : null;
  const domainMatches = !toks.length || host.includes(toks[0]) || toks.filter((t) => host.includes(t)).length * 2 > toks.length
    || (!!initials && host.startsWith(initials));
  const sitePath = pathOf(site).replace(/\/+$/, '');
  // The vendor's SCOPE on a shared site: its subpath minus a generic leaf, so a chain property
  // at /baymont/durango-colorado/baymont-durango/overview owns .../baymont-durango/rooms too.
  const scope = sitePath.replace(/\/(overview|home|index(\.html?)?|about|info)$/i, '');
  const parent = scope.replace(/\/[^/]*$/, '');
  const pathsCrawled = (h.pages || []).filter((p) => !p.error).map((p) => pathOf(p.url).replace(/\/+$/, ''));
  const rosterKids = new Set(pathsCrawled.filter((p) => ROSTER_PARENT.test(p + '/') && p.split('/').length > 2));
  const why = domainMatches ? null
    : sitePath && !/^\/(home|index(\.html?)?|all)?$/i.test(sitePath) ? `vendor website is a subpath (${sitePath}) of ${hostOf(site)}`
      : rosterKids.size >= 2 ? `${hostOf(site)} lists ${rosterKids.size} acts/vendors under a roster path`
        : null;
  // A page is the vendor's when it sits under the vendor's scope or its path names the vendor on
  // the STRICT match: /bands/into-the-groove contains "groove" but is a different act from
  // Groove Nation Orchestra.
  const inScope = (p) => (!!scope && (p === scope || p.startsWith(scope + '/'))) || namesVendor(p, toks, true);
  // A SIBLING is another entry under the same listing: same non-root parent as the vendor's
  // page (/bands/diamond-orchestra beside /bands/groove-nation-orchestra), or any roster child.
  // A root-level page (/faq, /about) is the host's own chrome, not another vendor.
  const sibling = (p) => !inScope(p) && ((!!parent && p.replace(/\/[^/]*$/, '') === parent) || rosterKids.has(p));
  // Old harvests have no per-image page, only the list of pages crawled. Their images are
  // attributable to the vendor unless the crawl reached a sibling's page or a platform's own
  // pages; Groove Nation's crawl reached four sibling bands, so it falls to the filename rule,
  // while a Wyndham property whose crawl only reached brand chrome (/baymont/about-us) keeps
  // its images for the screener -- which drops the brand promo graphics on sight.
  const oldAttributable = !pathsCrawled.some(sibling) && (!PLATFORM_HOST.test(hostOf(site)) || pathsCrawled.every(inScope));
  return { toks, sitePath, inScope, oldAttributable, agency: !!why, why };
}

// Does a page path or a filename name THIS vendor? Compact match on the first two distinctive
// tokens together ("groovenation2-1.jpg"), on a long first token alone, or on every token
// ("twp-sr-kingsclub" for King's Club; "gravity-haus-vail-spa" for The Spa at Gravity Haus Vail).
// `strict` (page paths) drops the long-first-token rule, which a sibling act's slug can share.
function namesVendor(s, toks, strict = false) {
  const c = compact(s);
  return !!toks.length && (c.includes(toks.slice(0, 2).join('')) || (!strict && toks[0].length >= 5 && c.includes(toks[0]))
    || (toks.length >= 2 && toks.every((t) => c.includes(t))));
}

// Old harvests stored bare URL strings; new ones store { url, page, alt }. Old ones also kept
// HTML entities undecoded, so a Jimdo src became https://<vendor>/https&#x3A;&#x2F;&#x2F;
// primary.jwwb.nl/... -- recover the embedded absolute URL (harvest.mjs now decodes at source).
const decodeEntities = (v) => v.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
function asImage(i) {
  const img = typeof i === 'string' ? { url: i, page: null } : { ...i };
  const u = decodeEntities(img.url);
  img.url = u.match(/^https?:\/\/[^/]+\/(https?:\/\/.+)$/)?.[1] || u;
  return img;
}

/** One reason string when the candidate is rejected, null when it may be used. */
function rejectReason(img, ctx) {
  const u = img.url, file = fileOf(u), text = `${decodeURIComponent(u)} ${img.alt || ''}`;
  if (STOCK_HOST.test(hostOf(u))) return `stock host: ${hostOf(u)}`;
  const sp = text.match(STOCK_PATH); if (sp) return `stock library name: "${sp[0]}"`;
  const tp = u.match(TEMPLATE_PATH); if (tp) return `theme/template asset path: "${tp[0]}"`;
  if (stockCaption(file)) return `stock-catalog caption filename: "${file.slice(0, 80)}"`;
  const wm = file.match(WATERMARK); if (wm) return `watermark/proof hint: "${wm[0]}"`;
  const pn = text.match(PERSON_NOT_WORK); if (pn) return `headshot/team/profile, not the work: "${pn[0]}"`;
  const jk = u.match(JUNK_URL); if (jk) return `logo/graphic: "${jk[0]}"`;
  if (PORTRAIT_URL.test(decodeURIComponent(u))) return 'people-as-subject (portrait filter on for this type)';
  if (ctx.agency) {
    // On a shared site only the vendor's OWN page counts. With page provenance (new harvests)
    // that is the website subpath or a page whose path names the vendor; without it (harvests
    // from before 2026-10) the only evidence left is a filename that names the vendor.
    const p = img.page ? pathOf(img.page).replace(/\/+$/, '') : null;
    const own = p != null ? ctx.inScope(p) : ctx.oldAttributable;
    if (!own && !namesVendor(file, ctx.toks, p != null)) {
      return p != null ? `multi-vendor site (${ctx.why}); image is from another page: ${p || '/'}`
        : `multi-vendor site (${ctx.why}); crawl reached other vendors' pages, no per-image page on file, and the filename does not name the vendor`;
    }
  }
  return null;
}

// 0 = gallery/portfolio/weddings, 1 = home or unknown page, 2 = other content, 3 = about/team.
function pageTier(img, ctx) {
  if (ABOUT_FILE.test(fileOf(img.url))) return 3;
  if (!img.page) return 1;
  const p = pathOf(img.page).replace(/\/+$/, '');
  if (GALLERY_PAGE.test(p)) return 0;
  if (!p || p === ctx.sitePath) return 1;
  return ABOUT_PAGE.test(p) ? 3 : 2;
}

// CDN URLs often point at downsized renditions; ask for the original/larger one.
function upgradeUrl(u) {
  const wix = u.match(/^(https:\/\/static\.wixstatic\.com\/media\/[^/]+)\/v1\//);
  if (wix) return wix[1];
  if (/\bwidth=\d+/.test(u)) return u.replace(/\bwidth=\d+/, 'width=1600');
  // WordPress thumbnails ("Britney-and-Kasper-2025-116-1-300x200.jpg") fail the size check and
  // cost a fetch slot; the full upload sits beside them without the -WxH suffix.
  if (/\/wp-content\/uploads\//.test(u)) return u.replace(/-\d{2,4}x\d{2,4}(\.(jpe?g|png|webp))$/i, '$1');
  return u;
}

// One photo, several renditions: WordPress serves /uploads/X.jpg, /wp-content/uploads/X.jpg and
// X-768x512.jpg; Duda serves X-403w.png and X-1920w.png. Unchecked, Emberlight's DSC04436
// alone filled three of five candidate slots. Key on the bare name, keep the largest rendition.
const RENDITION = /(-\d+x\d+|-\d+w|-scaled|-e\d{10,})+$/i;
// The key keeps the directory and query: Squarespace names every upload "image-asset.jpeg"
// under a unique id directory, and timthumb.php carries the image in its query string.
const renditionKey = (u) => {
  try {
    const x = new URL(u), dir = x.pathname.replace(/^\/wp-content\//, '/').replace(/[^/]*$/, '');
    return `${x.host}${dir}${fileOf(u).toLowerCase().replace(RENDITION, '')}${x.search.replace(/[?&](w|h|width|height|format|quality|q)=[^&]*/gi, '')}`;
  } catch { return u; }
};
const renditionSize = (u) => { const m = fileOf(u).match(/-(\d+)x\d+|-(\d+)w(?=$|-)/i); return m ? +(m[1] || m[2]) : Infinity; };

/** Rank one vendor's harvested images: { ranked, rejected, ctx }. Pure -- no network. */
function selectCandidates(h) {
  const ctx = siteContext(h);
  const rejected = [], ranked = [], seen = new Set(), byKey = new Map();
  for (const raw of h.images || []) {
    const img = asImage(raw);
    const url = upgradeUrl(img.url);
    if (seen.has(url)) continue;
    seen.add(url);
    const c = { url, page: img.page ?? null, alt: img.alt ?? null, filename: decodeURIComponent(pathOf(url).split('/').pop() || '') };
    const reason = rejectReason({ ...img, url }, ctx);
    if (reason) { rejected.push({ ...c, reason }); continue; }
    const cand = { ...c, tier: pageTier(img, ctx) }, key = renditionKey(url), prev = byKey.get(key);
    if (!prev) { byKey.set(key, cand); ranked.push(cand); continue; }
    const [keep, drop] = renditionSize(url) > renditionSize(prev.url) ? [cand, prev] : [prev, cand];
    if (keep === cand) { ranked[ranked.indexOf(prev)] = cand; byKey.set(key, cand); }
    rejected.push({ ...drop, reason: `duplicate rendition of ${keep.filename}` });
  }
  ranked.sort((a, b) => a.tier - b.tier); // stable: crawl order within a tier
  return { ranked, rejected, ctx };
}

const only = (argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean);
const researchDir = path.join(workdir, 'research');
for (const slug of fs.readdirSync(researchDir)) {
  if (only.length && !only.includes(slug)) continue;
  const hf = path.join(researchDir, slug, 'harvest.json');
  if (!fs.existsSync(hf)) continue;
  const h = JSON.parse(fs.readFileSync(hf, 'utf8'));
  // A site that failed the identity check is a DIFFERENT business, so none of its images show
  // this vendor -- the Fairmount Cemetery (Denver) row shipped New Jersey headstones from the
  // Newark cemetery's site. identity.json is written by dossier.mjs (identity.mjs); read only
  // the `flagged` verdict so this pass does not depend on that module's internals.
  let identity = null;
  try { identity = JSON.parse(fs.readFileSync(path.join(researchDir, slug, 'identity.json'), 'utf8')); } catch { /* not run yet */ }
  if (identity?.flagged) {
    const why = `identity check FAILED (${(identity.reasons || []).slice(0, 2).join('; ') || 'see identity.json'})`;
    console.log(`${slug}: SKIPPED, ${why}`);
    if (OUT) {
      const d = path.join(OUT, 'photos', slug);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'selection.json'), JSON.stringify({ vendor: h.name, website: h.website, skipped: why, picked: [], rejected: [] }, null, 2));
      if (!DRY) fs.writeFileSync(path.join(d, 'manifest.json'), '[]');
    }
    continue;
  }
  const { ranked, rejected, ctx } = selectCandidates(h);
  const provenance = (h.images || []).some((i) => typeof i !== 'string') ? 'page' : 'none (pre-2026-10 harvest)';
  const outDir = OUT && path.join(OUT, 'photos', slug);
  const writeSelection = (picked) => outDir && fs.writeFileSync(path.join(outDir, 'selection.json'), JSON.stringify({
    vendor: h.name, website: h.website, provenance, multi_vendor_site: ctx.why, picked, rejected,
  }, null, 2));
  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  if (DRY) {
    // Size is unknown without a download, so the dry-run pick is the top of the RANKING, not
    // the post-size-check pick. Close enough to audit the rules, which is what it is for.
    const picked = ranked.slice(0, PER_VENUE);
    writeSelection(picked);
    console.log(`\n${slug}: ${ranked.length} usable / ${rejected.length} rejected | provenance: ${provenance}${ctx.why ? ` | MULTI-VENDOR: ${ctx.why}` : ''}`);
    for (const p of picked) console.log(`  PICK t${p.tier} ${p.url}${p.page ? `  [page ${p.page}]` : ''}`);
    for (const r of rejected) console.log(`  drop ${r.reason}  <- ${r.filename.slice(0, 90)}`);
    continue;
  }

  for (const r of rejected) console.log(`  ${slug} drop: ${r.reason}  <- ${r.filename.slice(0, 90)}`);
  if (!ranked.length) { writeSelection([]); console.log(`${slug}: no usable image urls (${rejected.length} rejected)`); continue; }

  const candidates = [];
  for (const c of ranked) {
    if (candidates.length >= PER_VENUE * 2) break; // fetch a few extra, keep the best
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(c.url, { headers: { 'User-Agent': UA, Referer: c.page || h.website || c.url }, signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) { rejected.push({ ...c, reason: `fetch HTTP ${res.status}` }); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < MIN_W || (meta.height ?? 0) < MIN_H) { rejected.push({ ...c, reason: `too small (${meta.width}x${meta.height})` }); continue; }
      candidates.push({ ...c, buf, width: meta.width, height: meta.height, area: meta.width * meta.height });
    } catch (e) { rejected.push({ ...c, reason: `fetch/decode failed: ${e.name === 'AbortError' ? 'timeout' : e.message}` }); }
    await sleep(150);
  }
  // Page tier first (a gallery shot beats a bigger home-page hero), then pixel area.
  candidates.sort((a, b) => a.tier - b.tier || b.area - a.area);
  const picked = candidates.slice(0, PER_VENUE);
  for (const c of candidates.slice(PER_VENUE)) rejected.push({ ...c, buf: undefined, reason: 'surplus: outranked by the picks' });
  const manifest = [];
  for (let i = 0; i < picked.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    await sharp(picked[i].buf).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 }).toFile(path.join(outDir, `${n}.jpg`));
    await sharp(picked[i].buf).rotate().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 }).toFile(path.join(outDir, `${n}_thumb.jpg`));
    // source_url kept as the first field for older readers; source_page is null for images
    // harvested before page provenance existed (re-harvest with --sites-only to fill it).
    const { url, page, alt, filename, tier, width, height } = picked[i];
    manifest.push({ file: `${n}.jpg`, source_url: url, source_page: page, alt, source_filename: filename, page_tier: tier, width, height, multi_vendor_site: ctx.why });
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeSelection(manifest);
  console.log(`${slug}: kept ${picked.length}/${ranked.length} usable urls (${rejected.length} rejected, reasons in selection.json)`);
}
console.log(`\nphotos → ${path.join(OUT || '(dry run, nothing written)', 'photos')}/<slug>/NN.jpg (+_thumb)`);
