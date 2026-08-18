/**
 * The recon-prose gates enrich enforces, applied to the daily miner's drafted
 * entries. Kiara asked the miner to follow the same key gates as enrichvendors
 * (2026-08-17); these regexes are COPIED VERBATIM from
 * .claude/skills/enrichvendors/scripts/upload.mjs so the two cannot drift. If you
 * change a pattern there, change it here (same rule the codebase already applies
 * to MONEY, which lives in four places). Provenance and reasoning for each live
 * in that file - kept terse here.
 *
 * Difference from enrich: enrich HARD-FAILS the whole upload on any violation,
 * because a human is about to review the batch. This runs unattended, so a
 * violation DROPS that one entry (it is not inserted) and is reported - never
 * fails the cron, never publishes bad prose.
 */

import { MONEY } from "./lib.mjs";

const BANNED = /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;
const PROCESS = /\b(crawl\w*|scrape\w*|fetch\w*|dossier|harvest\w*|parse\w*|garbled text|boilerplate|batch\w*|enrich\w*|seeded|roster|pipeline|dataset|databases?|bots?|launchintel|digest\w*)\b/i;
const RESEARCH = new RegExp(
  [
    /\b404\b|\b403\w*/,
    /\bunreachable\b|\bautomated (check|lookup|request|tool)s?\b/,
    /\b(reviews (go|going) back to|no pricing to pull|nothing to pull)\b/,
    /(?:(?:did|would|could|does|do|will|can)\s*(?:n'?t|not)|failed to|never)\s+load\b(?!\s*-?\s*in\b)/,
    /\bsite (is|was)?\s*(down|unavailable|unreadable|inaccessible)\b/,
    /\b(couldn'?t|could not|can'?t|cannot) (access|reach|open|read) (the |their )?(site|page|website)\b/,
    /\bsite is (a )?dead link\b|\bper (their|the) (site|listing) copy\b/,
  ]
    .map((r) => r.source)
    .join("|"),
  "i",
);
const EMDASH = /[—–]/;
const ESCAPES = /\\{1,2}[rnt]/;
const QUOTE_ONLY = /(?:(?:pricing|price|prices|rates?|available|custom|by|on|via|per)\s+)*quotes?[\s-]+only|only\s+(?:available\s+)?(?:by|upon|on|via)\s+quotes?/i;

/** Repair literal line-break escapes to real newlines (as enrich does at insert). */
export function repairBreaks(text) {
  return String(text ?? "").replace(/\\{1,2}r?\\?n/g, "\n");
}

/**
 * Check one drafted entry against the enrich prose gates. Returns an array of
 * human-readable errors (empty = clean). The caller drops any entry with errors.
 */
export function checkProse({ notes, price_text, price_details }) {
  const errors = [];
  if (!notes || !String(notes).trim()) errors.push("empty notes");
  if (!price_text || !String(price_text).trim()) errors.push("price_text is required on every entry");
  if (!price_details || !String(price_details).trim())
    errors.push("price_details is required on every entry");

  const text = `${price_text ?? ""} ${price_details ?? ""} ${notes ?? ""}`;
  const banned = text.match(BANNED);
  if (banned) errors.push(`banned marketing/AI phrase "${banned[0]}"`);
  const tell = text.match(PROCESS);
  if (tell) errors.push(`process-tell "${tell[0]}"`);
  const artifact = text.match(RESEARCH);
  if (artifact) errors.push(`research-artifact narration "${artifact[0]}"`);
  if (EMDASH.test(text)) errors.push("em/en dash in entry text");
  if (ESCAPES.test(text)) errors.push("literal line-break escape in entry text");

  // Per field: a quote-only headline that also states a figure contradicts itself.
  for (const [col, val] of [["price_text", price_text], ["price_details", price_details]]) {
    if (val && QUOTE_ONLY.test(val) && MONEY.test(val))
      errors.push(`${col} says pricing is quote-only but states a figure ("${String(val).slice(0, 60)}")`);
  }
  return errors;
}
