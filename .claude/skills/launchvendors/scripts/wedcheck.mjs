// Wedding-intent check for sweep-sourced rows (types with a profile `intent` regex).
// A sweep query has wedding intent, but Places pads results with noise (portrait studios,
// music schools, everyday flower shops, corporate caterers). Evidence is checked in cost
// order — NAME/URL → WEBSITE HOMEPAGE → [SAME-HOST SUBPAGES, types that opt in] → GOOGLE
// REVIEWS (Kiara's rule: a review describing their wedding rescues a vendor whose site never
// says "wedding") — and rows with no evidence anywhere are PRUNED, not flagged (Kiara,
// 2026-07: humans skim large lists, they don't audit them). Pruned rows move to
// <workdir>/pruned.csv with a reason; a reddit-vouched vendor re-enters later via the
// research/candidates path.
//   kept       name/url, site, subpage, or reviews show wedding|bridal|... evidence
//   PRUNED:non-wedding   site read fine + reviews read fine, zero wedding evidence
//   PRUNED:no-evidence   no website at all and no wedding evidence in reviews
//   WED_UNVERIFIED       has a website we could NOT read and reviews don't rescue it —
//                        kept + flagged, and settled in Phase 4 by adjudicate.mjs (agent
//                        judgment since 2026-07-26, no human review pass)
// Research-sourced rows (reddit/ig/web provenance) are skipped: their sources are already
// wedding-scoped. Idempotent — flagged/pruned rows are not re-fetched or resurrected.
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs <workdir> [--type music]
import path from 'node:path';
import { readVenues, writeVenues, appendPruned, placeDetails, sleep, typeProfile } from './lib.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: wedcheck.mjs <workdir> [--type <type>]'); process.exit(1); }
const profile = typeProfile();
if (!profile.intent) { console.log(`wedcheck(${profile.key}): no intent config for this type — nothing to do`); process.exit(0); }

const file = path.join(workdir, profile.csv);
const venues = readVenues(file);

const targets = venues.filter((v) =>
  v.provenance === 'places-sweep' && !/WED_UNVERIFIED/.test(v.flags));

let keptName = 0, keptSite = 0, keptSubpage = 0, keptReviews = 0, flaggedUnv = 0;
const pruned = [];
const queue = [];
for (const v of targets) {
  // Name OR website-URL evidence skips the fetch ("boulderweddingphoto.com" speaks for itself).
  if (profile.intent.test(v.name) || profile.intent.test(v.website || '')) { keptName++; continue; }
  queue.push(v);
}

async function fetchText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WeddingRecon/1.0; +vendor-directory-check)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.text()).slice(0, 400_000);
}

/**
 * Same-host subpage probe — the fix for types whose evidence never sits on a HOMEPAGE
 * (hotels: "room block"/"group rate" live on /weddings, /groups, /meetings). Gated on the
 * profile defining `intentSubpage`, so every existing type's behavior is byte-identical.
 *
 * Why this and not the pruned.csv rescue list (Kiara, 2026-07-26): the rescue path only
 * recovers a hotel that some OTHER source happens to name, so a property whose own site
 * documents its block but that no listicle mentions is silently lost. Following its own
 * link is both more complete and cheaper — these are plain HTTP fetches inside a script,
 * so they cost ZERO orchestrator tokens and no API quota, and they run BEFORE the Places
 * reviews check (which does cost quota), so a subpage hit actually saves a paid call.
 *
 * Bounded on purpose: same host only, ≤SUBPAGE_CAP pages, matched on href OR anchor text.
 */
const SUBPAGE_CAP = 3;
function subpageLinks(html, baseUrl, rx, cap) {
  let base;
  try { base = new URL(baseUrl); } catch { return []; }
  const out = new Set();
  const re = /<a\b[^>]*\bhref=["']([^"'\s>]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null && out.size < cap) {
    const href = m[1];
    const label = m[2].replace(/<[^>]*>/g, ' ');
    if (!rx.test(href) && !rx.test(label)) continue;
    try {
      const u = new URL(href, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (u.hostname !== base.hostname) continue;      // never wander off the vendor's own site
      u.hash = '';
      const norm = u.href.replace(/\/$/, '');
      if (norm === base.href.replace(/\/$/, '')) continue;
      out.add(norm);
    } catch { /* skip malformed href */ }
  }
  return [...out];
}

async function subpagesHaveIntent(html, baseUrl) {
  for (const link of subpageLinks(html, baseUrl, profile.intentSubpage, SUBPAGE_CAP)) {
    try { if (profile.intent.test(await fetchText(link))) return true; } catch { /* try next */ }
  }
  return false;
}

// Kiara's rescue rule, mechanized: a Google review describing their wedding keeps the
// row even when the site never says "wedding". Reviews ride the SKU we already pay for.
async function reviewsHaveIntent(placeId) {
  if (!placeId) return false;
  try {
    const d = await placeDetails(placeId, 'reviews');
    await sleep(120);
    return (d.reviews || []).some((r) => profile.intent.test(r.text?.text || r.originalText?.text || ''));
  } catch { return false; }
}

const CONC = 8;
for (let i = 0; i < queue.length; i += CONC) {
  await Promise.all(queue.slice(i, i + CONC).map(async (v) => {
    let siteVerdict = null;                 // true=evidence, false=read-fine-no-evidence, null=unreadable/none
    let homeHtml = '';
    if (v.website) {
      try { homeHtml = await fetchText(v.website); siteVerdict = profile.intent.test(homeHtml); }
      catch { siteVerdict = null; }
    }
    if (siteVerdict === true) { keptSite++; return; }
    // Free same-host subpage probe before the PAID reviews call — see subpagesHaveIntent.
    if (profile.intentSubpage && homeHtml && await subpagesHaveIntent(homeHtml, v.website)) {
      keptSubpage++; return;
    }
    if (await reviewsHaveIntent(v.place_id)) { keptReviews++; return; }
    if (v.website && siteVerdict === null) {
      // A site exists but we couldn't read it, and reviews don't rescue — the one case
      // that still needs a judgment call. Keep, flagged for Phase 4 adjudication.
      v.flags = v.flags ? `${v.flags};WED_UNVERIFIED` : 'WED_UNVERIFIED';
      flaggedUnv++;
      return;
    }
    v.flags = siteVerdict === false ? 'PRUNED:non-wedding' : 'PRUNED:no-evidence';
    pruned.push(v);
  }));
}

const prunedSet = new Set(pruned);
writeVenues(file, venues.filter((v) => !prunedSet.has(v)));
appendPruned(workdir, pruned);
console.log(`wedcheck(${profile.key}): ${targets.length} sweep rows | kept by name/url ${keptName}, by site ${keptSite}${profile.intentSubpage ? `, by subpage ${keptSubpage}` : ''}, by reviews ${keptReviews} | PRUNED ${pruned.length} → pruned.csv | WED_UNVERIFIED ${flaggedUnv}`);
if (pruned.length) {
  console.log('\nPRUNED (rescue by moving the row back from pruned.csv):');
  for (const v of pruned) console.log(`  ${v.name} (${v.city || '?'}) | ${v.flags}${v.website ? ' | ' + v.website : ''}`);
}
const flagged = venues.filter((v) => !prunedSet.has(v) && /WED_UNVERIFIED/.test(v.flags));
if (flagged.length) {
  console.log('\nFLAGGED (site exists but unreadable — adjudicate these in Phase 4):');
  for (const v of flagged) console.log(`  ${v.name} (${v.city || '?'}) | ${v.website}`);
}
