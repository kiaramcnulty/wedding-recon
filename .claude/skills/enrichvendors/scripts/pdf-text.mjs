// Minimal, dependency-free PDF text extraction for the harvest.
//
// Why this exists: vendors very often publish their wedding rate card as a PDF and
// nothing else. The harvest used to RECORD those links ("pdf rate cards seen on site
// (not fetched)") without ever reading them, which put a hole in the corpus exactly
// where pricing lives — measured 2026-08-01 at 112/679 CO venues with an unfetched PDF,
// 24 of them explicitly pricing/wedding-named. No amount of prompt tuning recovers a
// number that was never harvested.
//
// Why hand-rolled: there is no pdftotext/mutool on the host and no PDF library in the
// project. A rate card is essentially always a digitally-generated PDF (not a scan), so
// the text sits in Flate-compressed content streams that node:zlib can inflate directly.
// That covers the case we care about. Scanned/image-only PDFs return little or nothing —
// callers must treat a short result as "no text", not as "no pricing".
import zlib from 'node:zlib';

// Image payloads, identified from the stream's own dictionary. Skipping these BEFORE
// inflating is what makes big files affordable: a 48MB brochure measured as 47.6MB of
// image streams against 0.1MB of text, and inflating only the latter took 0.0s. Without
// this the decompressed JPEG data dwarfs everything and the file has to be abandoned.
const IMAGE_STREAM = /\/Subtype\s*\/Image|\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode|\/JBIG2Decode/;

/** Inflate every Flate-encoded, non-image stream in the raw PDF bytes. */
function inflateStreams(buf) {
  const out = [];
  // Work on latin1 so byte offsets and string indices stay 1:1.
  const s = buf.toString('latin1');
  // The lookbehind matters: "endstream" contains "stream", so a naive scan matches the
  // terminator and then reads from a garbage offset (every inflate fails with
  // "endobj..." as the stream head). Anchor on a real stream keyword only.
  const re = /(?<!end)stream\r?\n?/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    // The object dictionary sits just before the `stream` keyword; consult it so image
    // payloads are never decompressed.
    if (IMAGE_STREAM.test(s.slice(Math.max(0, m.index - 400), m.index))) { re.lastIndex = end + 9; continue; }
    // Trailing EOL before `endstream` is delimiter, not payload.
    let stop = end;
    if (s[stop - 1] === '\n') stop--;
    if (s[stop - 1] === '\r') stop--;
    const raw = buf.subarray(start, stop);
    // Only Flate streams are worth trying; others (images, fonts) are noise.
    try {
      out.push(zlib.inflateSync(raw).toString('latin1'));
    } catch {
      try { out.push(zlib.inflateRawSync(raw).toString('latin1')); } catch { /* not text */ }
    }
    re.lastIndex = end + 9; // past 'endstream'
  }
  return out;
}

/** Decode a PDF literal string body, honouring the escapes that matter for text. */
function decodeLiteral(body) {
  return body.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, e) => {
    switch (e) {
      case 'n': return '\n'; case 'r': return '\r'; case 't': return '\t';
      case 'b': return ''; case 'f': return '';
      case '(': return '('; case ')': return ')'; case '\\': return '\\';
      default: return String.fromCharCode(parseInt(e, 8));
    }
  });
}

/**
 * Pull the text-showing operators out of one content stream.
 * Handles `(lit) Tj`, `<hex> Tj`, and `[(a) -250 (b)] TJ` arrays — the TJ array form is
 * what most generators emit for kerned runs, so skipping it loses most of the document.
 */
function textFromStream(content, cmap = null) {
  let out = '';
  // Literal strings, hex strings, and the array form, in document order.
  const re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bTJ\b|\bTj\b|\bTD\b|\bTd\b|\bT\*\b|\bET\b/g;
  let m;
  let pendingBreak = false;
  while ((m = re.exec(content))) {
    const tok = m[0];
    if (tok === 'TD' || tok === 'Td' || tok === 'T*' || tok === 'ET') { pendingBreak = true; continue; }
    if (tok === 'TJ' || tok === 'Tj') continue;
    if (pendingBreak) { out += '\n'; pendingBreak = false; }
    if (tok.startsWith('(')) {
      const lit = decodeLiteral(tok.slice(1, -1));
      if (cmap) {
        // Under a CID font the literal's bytes are glyph ids, two bytes per glyph.
        let s = '';
        for (let i = 0; i + 1 < lit.length; i += 2) {
          s += cmap.get((lit.charCodeAt(i) << 8) | lit.charCodeAt(i + 1)) ?? '';
        }
        out += s || lit;
      } else out += lit;
    } else if (tok.startsWith('<')) {
      const hex = tok.slice(1, -1).replace(/\s+/g, '');
      if (cmap) {
        for (let i = 0; i + 3 < hex.length; i += 4) {
          out += cmap.get(parseInt(hex.slice(i, i + 4), 16)) ?? '';
        }
      } else if (hex.length % 4 === 0 && /^(00|0[1-9A-Fa-f]|[1-9A-Fa-f])/.test(hex)) {
        // 4-hex-digit groups are UTF-16BE; 2 are single bytes.
        for (let i = 0; i + 3 < hex.length; i += 4) {
          const cp = parseInt(hex.slice(i, i + 4), 16);
          if (cp >= 32 && cp < 0xfffd) out += String.fromCharCode(cp);
        }
      } else {
        for (let i = 0; i + 1 < hex.length; i += 2) {
          const cp = parseInt(hex.slice(i, i + 2), 16);
          if (cp >= 32) out += String.fromCharCode(cp);
        }
      }
    }
  }
  return out;
}

/**
 * Build a glyph-id → unicode map from every /ToUnicode CMap in the document.
 *
 * Type0/CIDFontType2 fonts (what InDesign and Illustrator emit, so: most modern rate
 * cards) store text as font-specific glyph ids, not characters. The mapping back lives in
 * each font's ToUnicode CMap.
 *
 * Doing this properly means resolving /Resources → /Font → /ToUnicode per content stream
 * and tracking the current Tf — i.e. a real PDF object parser. Instead we merge every
 * CMap in the file and **refuse to use the merged map at all if two fonts disagree about
 * any glyph id**. That matters: a silently mis-decoded map would rewrite "$5,000" into a
 * different, plausible-looking number, and a wrong price is far worse than no price.
 * Single-font-family documents (the common case) decode; ambiguous ones return null and
 * the caller falls back to reporting no text.
 */
function buildToUnicode(streams) {
  const map = new Map();
  let conflicted = false;
  const hexToStr = (h) => {
    let s = '';
    for (let i = 0; i + 3 < h.length; i += 4) {
      const cp = parseInt(h.slice(i, i + 4), 16);
      if (cp >= 32 && cp !== 0xfffd) s += String.fromCharCode(cp);
    }
    return s;
  };
  const put = (k, v) => {
    if (!v) return;
    const prev = map.get(k);
    if (prev !== undefined && prev !== v) { conflicted = true; return; }
    map.set(k, v);
  };
  for (const st of streams) {
    if (!/beginbfchar|beginbfrange/.test(st)) continue;
    for (const blk of st.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const p of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        put(parseInt(p[1], 16), hexToStr(p[2].padStart(4, '0')));
      }
    }
    for (const blk of st.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const p of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16), dst = parseInt(p[3], 16);
        if (hi - lo > 65535) continue;
        for (let c = lo; c <= hi; c++) {
          const cp = dst + (c - lo);
          if (cp >= 32 && cp !== 0xfffd) put(c, String.fromCharCode(cp));
        }
      }
    }
  }
  if (conflicted || map.size === 0) return null;
  return map;
}

/** Share of bytes that are ordinary printable ASCII — separates text from image payloads. */
function printableRatio(s) {
  const sample = s.length > 4000 ? s.slice(0, 4000) : s;
  if (!sample.length) return 0;
  return (sample.match(/[\x20-\x7E\n\r\t]/g) || []).length / sample.length;
}

/**
 * Rejoin numbers that kerning split across text runs, and drop language-span artifacts.
 *
 * Generators emit kerned digits as separate show operators, so a rate card reads out as
 * "$5 9 pp" or "$ 3, 500". Left alone that is worse than useless downstream: "$ 3," is
 * ambiguous between $3,000 and $3,500, and this whole exercise exists to stop wrong
 * numbers entering the corpus. Only spaces BETWEEN digits (optionally around a comma or
 * decimal point) are removed, so "$60 per person" keeps its space.
 */
function healNumbers(s) {
  return s
    // Lang-span markers, which butt straight against the next word ("en-USCustomizable"),
    // so this deliberately does not require a trailing word boundary.
    .replace(/\b[a-z]{2}-[A-Z]{2}(?![a-z])/g, ' ')
    .replace(/\$\s+(?=\d)/g, '$')                            // "$ 106" -> "$106"
    .replace(/(\d)\s+(?=[.,]\s*\d)/g, '$1')                  // "3 ,500" -> "3,500"
    .replace(/(\d[.,])\s+(?=\d)/g, '$1')                     // "3, 500" -> "3,500"
    .replace(/(\d)\s(?=\d{1,3}\b)/g, (m, d, off, str) => {
      // Join bare digit runs ("5 9" -> "59") only inside something already money-shaped,
      // so page numbers and "2 hours 30 minutes" are left alone.
      const near = str.slice(Math.max(0, off - 12), off + 6);
      return /\$/.test(near) ? d : m;
    })
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * Drop lines that are non-ASCII noise OR partially-decoded garbage.
 *
 * The second case is the dangerous one and is NOT caught by a printable-ratio test: a
 * half-decoded font yields ASCII that reads like data but isn't. A real observed example
 * (San Sophia Overlook's PDF) produced `'$188`, `$085>B`, `!:44$08B$085>B` — every one of
 * those would be read as a price by anything scanning for `\$\d+`. A fabricated rate is
 * far worse than a missing one, so any line whose money tokens aren't cleanly formed, or
 * which is dense with stray symbols, is discarded outright.
 */
const dropBinaryLines = (s) => s.split('\n')
  .filter((ln) => !ln.trim() || printableRatio(ln) > 0.8).join('\n');

/**
 * Document-level sanity check on money tokens, applied AFTER number healing.
 *
 * A partially-decoded font emits ASCII that reads like data but isn't. San Sophia
 * Overlook's PDF produced `$085>B`, `$08B`, `$045`, `'$1881-8` — anything scanning for
 * `\$\d+` reads those as prices, and a fabricated rate is far worse than a missing one.
 * Judging line by line is unreliable (some debris is shaped exactly like a real figure),
 * but the DOCUMENT signal is decisive: a correctly-decoded file has essentially no
 * malformed money tokens, while a mis-decoded one is full of them. Above the threshold we
 * discard the whole extraction, so the caller reports "unreadable" rather than inventing
 * numbers.
 *
 * Only tokens where `$` is actually followed by a digit are judged — those are the ones
 * something downstream would read as a price. A `$` sitting in leftover binary is noise,
 * not a false price claim, and counting it in the denominator wrongly condemned a clean
 * file (Gateway: 6 real prices alongside 3 debris tokens). Likewise a lost space
 * ("$3,000wedding") is a formatting artifact, not corruption, so letters after a
 * well-formed number are fine. What actually marks a mis-decode is a malformed NUMBER:
 * a leading zero, or a stray symbol welded to the digits.
 */
/**
 * Does this read as English prose, or as a mis-decoded font?
 *
 * The decisive signal, and the one that generalises. A wrong glyph map still emits plenty
 * of letter-shaped tokens — Telluride's PDF yielded 1,059 words of 4+ letters — but
 * scrambles the function words, so it contained ZERO instances of "the", "and", "for",
 * etc. Real documents are dense with them. This catches corruption whether or not the
 * file happens to contain prices, which the money check alone cannot.
 */
const FUNCTION_WORDS = /\b(the|and|for|with|from|this|that|are|our|you|your|will|per|of|to|in|is|at|by|or|be)\b/gi;
function readsAsEnglish(s) {
  const words = (s.match(/\b[A-Za-z]{4,}\b/g) || []).length;
  if (words < 40) return true; // too little text to judge; length/letter checks still apply
  const fn = (s.match(FUNCTION_WORDS) || []).length;
  return fn / words > 0.02;
}

function moneyLooksSane(s) {
  const toks = [...s.matchAll(/\$\s?\d[^\s$]{0,14}/g)].map((m) => m[0]);
  if (toks.length < 3) return true; // too few to judge; other guards still apply
  let bad = 0;
  for (const t of toks) {
    const body = t.replace(/^\$\s?/, '');
    const num = (body.match(/^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/) || [''])[0];
    if (!num || /^0\d/.test(num)) { bad++; continue; }   // "$085", "$08" — prices don't lead with 0
    if (/^[<>|^~{}\\@#*_=]/.test(body.slice(num.length))) bad++; // "$085>B"
  }
  return bad / toks.length <= 0.2;
}

/**
 * Extract readable text from PDF bytes. Returns '' when the file is a scan, encrypted,
 * or uses an encoding this extractor can't map — callers should treat '' as "unknown",
 * never as "no pricing published".
 */
export function pdfText(buffer, { maxBytes = 40 * 1024 * 1024, guard = true } = {}) {
  // Image streams are skipped before inflating (see IMAGE_STREAM), so size no longer
  // drives parse cost — a 48MB file measured 0.03s. This bound is only about the memory
  // held for the latin1 view of the buffer.
  if (buffer.length > maxBytes) return '';
  const streams = inflateStreams(buffer);
  const cmap = buildToUnicode(streams);
  let text = '';
  for (const stream of streams) {
    // `BT` (begin text object) is the reliable marker of a content stream. Testing Tj/TJ
    // alone lets decompressed JPEG/bitmap payloads through, because random binary hits
    // those letter pairs constantly — that noise then swamps the real text.
    if (!/\bBT\b/.test(stream) || !/\b(Tj|TJ)\b/.test(stream)) continue;
    // Glyph-id text is legitimately non-ASCII, so the printable check only applies when
    // we have no CMap to decode it with.
    if (!cmap && printableRatio(stream) < 0.6) continue;
    text += textFromStream(stream, cmap) + '\n';
  }
  const healed = healNumbers(dropBinaryLines(text));
  // Refuse the whole extraction rather than emit fabricated-looking figures. Two layers:
  // the language test catches a wholesale mis-decode; the money test catches the narrower
  // case where prose decodes but digits (often a separate subset font) do not.
  // `guard: false` is for diagnostics only — never turn it off in the harvest.
  if (guard && (!readsAsEnglish(healed) || !moneyLooksSane(healed))) return '';
  return healed
    .replace(/ /g, '')
    // Collapse the single-glyph-per-operator output some generators produce.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True when extraction produced enough real words to be worth keeping. */
export function looksLikeText(s) {
  if (!s || s.length < 40) return false;
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  return letters / s.length > 0.35;
}
