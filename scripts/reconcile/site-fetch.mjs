/**
 * Fetch a vendor's OWN website as plain text, for the daily tag/recon miner.
 *
 * The miner reads only the vendor's own site (Kiara, 2026-08-17) - never Google
 * reviews, web search, or third-party pages - because an own-site quote can only
 * be about that business, which removes the mis-attribution risk that web search
 * carries. So this is deliberately small: the homepage plus a few same-host pages
 * whose link looks like pricing / weddings / FAQ, stripped to text and capped.
 *
 * Runs on the GitHub Actions runner (full internet egress), NOT in the Claude web
 * sandbox, which cannot crawl arbitrary sites.
 */

const UA =
  "Mozilla/5.0 (compatible; WeddingReconBot/1.0; +https://github.com/kiaramcnulty/wedding-recon)";
const PAGE_TIMEOUT_MS = 12000;
const MAX_PAGES = 4; // homepage + up to 3 linked pages
const MAX_HTML_BYTES = 1_500_000; // do not read a runaway page into memory
const MAX_TEXT_PER_PAGE = 8000; // chars kept per page after stripping
const MAX_TEXT_TOTAL = 24000; // chars handed to the model across all pages

// Link text / href that suggests a page a couple cares about for filters.
const RELEVANT = /pric|packag|wedding|event|cater|rental|rate|faq|info|about|book|amenit|room|suite|menu|service/i;

/** Strip a fetched HTML document to readable text. */
function htmlToText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|xml/i.test(ct)) return { ok: false, status: `non-html (${ct})` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) return { ok: false, status: "too-large" };
    return { ok: true, html: new TextDecoder("utf-8", { fatal: false }).decode(buf), finalUrl: res.url };
  } catch (e) {
    return { ok: false, status: e.name === "AbortError" ? "timeout" : String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/** Same-host links whose href or anchor text looks filter-relevant. */
function relevantLinks(html, baseUrl) {
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, " ");
    let u;
    try {
      u = new URL(href, base);
    } catch {
      continue;
    }
    if (u.host !== base.host) continue; // OWN site only
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = "";
    const key = u.pathname.toLowerCase();
    if (key === "/" || seen.has(key)) continue;
    if (!RELEVANT.test(href) && !RELEVANT.test(label)) continue;
    seen.add(key);
    out.push(u.toString());
  }
  return out;
}

/**
 * Fetch up to MAX_PAGES of a vendor's own site and return the combined text (or
 * null if the homepage could not be read). `pages` is [{url, chars}] for the
 * report. Never throws - a fetch failure yields null, not an exception.
 */
export async function fetchSiteText(website) {
  if (!website) return null;
  const start = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const home = await fetchPage(start);
  if (!home.ok) return { text: null, pages: [], error: home.status };

  const parts = [];
  const pages = [];
  const homeText = htmlToText(home.html).slice(0, MAX_TEXT_PER_PAGE);
  parts.push(homeText);
  pages.push({ url: home.finalUrl || start, chars: homeText.length });

  for (const link of relevantLinks(home.html, home.finalUrl || start)) {
    if (pages.length >= MAX_PAGES) break;
    const r = await fetchPage(link);
    if (!r.ok) continue;
    const text = htmlToText(r.html).slice(0, MAX_TEXT_PER_PAGE);
    if (text.length < 40) continue;
    parts.push(text);
    pages.push({ url: link, chars: text.length });
  }

  const text = parts.join("\n\n---\n\n").slice(0, MAX_TEXT_TOTAL);
  return { text, pages, error: null };
}
