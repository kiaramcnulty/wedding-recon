/**
 * Query tokenization for vendor name search.
 *
 * Both search surfaces (Explore bar → `search_vendors` RPC, Add Recon box →
 * `/api/places`) used to match the *entire* typed string as one contiguous
 * substring (`name ILIKE '%<whole query>%'`). That failed the moment the query
 * carried a word the stored name doesn't — most visibly a leading article:
 * "the sanctuary" never matched the vendor stored as "Sanctuary Golf Course",
 * even though "sanctuary" did.
 *
 * We instead split the query into meaningful tokens, drop a small set of stop
 * words, and require *each* remaining token to appear (AND). This is forgiving
 * of articles, word order, and filler words, while staying precise — every real
 * word the user typed must still be present.
 *
 * The RPC (`supabase/migrations/0019_search_vendors_tokenized.sql`) applies the
 * same rule in SQL; keep this STOP_WORDS set in sync with the one there.
 */

/**
 * Articles / prepositions / conjunctions that show up as noise in vendor names.
 * Small and conservative on purpose — these are almost never the distinguishing
 * word in a name, so dropping them only helps recall.
 */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "at",
  "on",
  "in",
  "or",
  "to",
  "for",
  "by",
  "&",
]);

/** Cap tokens so a pasted paragraph can't build a pathological query. */
const MAX_TOKENS = 12;

/** Strip characters that are LIKE wildcards (or escape) so they stay literal. */
function stripLikeMeta(s: string): string {
  return s.replace(/[%_\\]/g, "");
}

/** Trim surrounding punctuation but keep in-word marks (apostrophes, &, digits). */
function trimPunctuation(s: string): string {
  return s.replace(/^[^\p{L}\p{N}&']+|[^\p{L}\p{N}&']+$/gu, "");
}

/**
 * Split a search query into lowercase, LIKE-safe tokens with stop words removed.
 * If the query is *only* stop words (e.g. "the"), we fall back to the raw tokens
 * so the search still does something rather than matching everything.
 */
export function searchTokens(query: string): string[] {
  const raw = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => trimPunctuation(stripLikeMeta(t)))
    .filter(Boolean);

  const meaningful = raw.filter((t) => !STOP_WORDS.has(t));
  const tokens = meaningful.length > 0 ? meaningful : raw;
  return tokens.slice(0, MAX_TOKENS);
}
