/**
 * Bounded-concurrency fan-out + transient retry for the Explore map's per-type
 * RPC calls.
 *
 * The map issues one `vendors_in_bbox` (and, once filtering, one
 * `vendor_filters_in_bbox`) call PER VENDOR TYPE — about a dozen — because a
 * single PostgREST response is capped at POSTGREST_MAX_ROWS and the corpus is
 * larger (see vendor-map.tsx). Those calls used to run through `Promise.all`, so
 * one map load opened ~12 Postgres connections at once. On the free-tier pooler a
 * handful of simultaneous visitors then exhausted the pool and every request came
 * back 503 — blanking the map for everyone (a Reddit traffic spike surfaced this
 * on 2026-08-14: healthy all day, then a burst of `POST /rpc/vendors_in_bbox`
 * 503s the instant real traffic arrived).
 *
 * Two levers here, both about surviving that surge without touching the DB:
 *   - a concurrency CAP, so one visitor's peak connection demand is small and
 *     many more visitors fit under the same ceiling; and
 *   - a small bounded RETRY, so a transient 503 is re-tried rather than left to
 *     blank the map. Bounded on purpose — retrying hard during an overload only
 *     deepens it, so this smooths a brief blip; sustained saturation is what the
 *     cap (and a bigger DB) are for.
 */

/** The slice of a supabase-js RPC result this module needs to inspect. */
export interface RpcResultLike {
  error: { message?: string | null; code?: string | null } | null;
  /** HTTP status of the resolved request; supabase-js sets it on the result. */
  status?: number;
}

/**
 * Run `task` over `items` with at most `limit` running at once, returning the
 * results IN INPUT ORDER — callers index the result array against the input
 * (e.g. `responses[i]` ↔ `ALL_VENDOR_TYPES[i]`), so order must be preserved even
 * though tasks finish out of order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runWorker = async (): Promise<void> => {
    // `cursor++` is atomic here: nothing awaits between reading and incrementing
    // it, so two workers can never claim the same index.
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await task(items[i], i);
    }
  };
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    runWorker,
  );
  await Promise.all(workers);
  return results;
}

/**
 * Whether a resolved RPC result is worth retrying. A capacity/gateway failure
 * (502/503/504), a rate limit (429), any other 5xx, or a network-level drop
 * (status 0) is transient. A deterministic 4xx — most importantly a 404 for a
 * function a migration has not added yet (PGRST202) — is NOT retried: it returns
 * the same thing on a second call, and the map's graceful fallbacks want to see
 * it promptly rather than after two backoffs.
 */
export function isRetryableRpcResult(r: RpcResultLike): boolean {
  if (!r.error) return false;
  const { status } = r;
  if (status !== undefined) {
    // A resolved HTTP status: retry capacity/gateway (502/503/504), rate limits
    // (429), any other 5xx, and network drops (status 0). A deterministic 4xx —
    // most importantly a 404 for a function a migration has not added yet
    // (PGRST202) — returns the same on retry, so don't.
    if (status === 0 || status === 429 || status >= 500) return true;
    if (status >= 400) return false;
  }
  // No usable status (an older client shape, or a pre-response network error) —
  // fall back to the message text.
  const msg = (r.error.message ?? "").toLowerCase();
  return /unavailable|timeout|timed out|fetch failed|failed to fetch|network/.test(
    msg,
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call `run` (which must issue a FRESH request each time) and retry a transient
 * failure up to `retries` times with exponential backoff plus jitter. The happy
 * path pays nothing: one call, returned as-is. Errors that are not transient are
 * returned immediately too.
 */
export async function withRpcRetry<T extends RpcResultLike>(
  run: () => PromiseLike<T>,
  { retries = 2, baseDelayMs = 250 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let result = await run();
  for (
    let attempt = 0;
    attempt < retries && isRetryableRpcResult(result);
    attempt++
  ) {
    // Exponential backoff (250ms, 500ms, …) with up to a full step of jitter so
    // a page's dozen calls do not all retry on the same beat.
    await sleep(baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs);
    result = await run();
  }
  return result;
}
