#!/usr/bin/env node
/**
 * Tests for the Explore map's RPC fan-out helpers (lib/map/rpc-fanout.ts).
 *
 *   node scripts/test-rpc-fanout.mjs
 *
 * These guard the fix for the 2026-08-14 503 storm: the map fans a bbox query
 * out to ~12 per-type RPCs, and firing all at once via Promise.all exhausted the
 * free-tier connection pool the moment real (Reddit) traffic arrived. The cap
 * must NEVER reorder results — callers index responses against ALL_VENDOR_TYPES —
 * and must never exceed its limit; the retry must ride out a transient 503 but
 * not a deterministic 404 (a function a migration has not added yet).
 */
import {
  mapWithConcurrency,
  isRetryableRpcResult,
  withRpcRetry,
} from "../lib/map/rpc-fanout.ts";

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) passed++;
  else {
    failed++;
    console.error("FAIL:", name);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// mapWithConcurrency: order preserved, limit respected, all processed.
{
  const items = Array.from({ length: 12 }, (_, i) => i);
  let inFlight = 0;
  let maxInFlight = 0;
  const out = await mapWithConcurrency(items, 4, async (n) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(5 + (n % 3) * 5); // finish out of order
    inFlight--;
    return n * 10;
  });
  ok("order preserved despite out-of-order completion", out.every((v, i) => v === i * 10));
  ok("never exceeds the concurrency limit", maxInFlight <= 4);
  ok("processes every item", out.length === 12);
}

// Edge cases.
{
  const empty = await mapWithConcurrency([], 4, async () => 1);
  ok("empty input -> empty output", Array.isArray(empty) && empty.length === 0);

  const single = await mapWithConcurrency([7], 4, async (n) => n + 1);
  ok("single item", single.length === 1 && single[0] === 8);

  let mx = 0;
  let n = 0;
  await mapWithConcurrency([1, 2], 10, async () => {
    n++;
    mx = Math.max(mx, n);
    await sleep(2);
    n--;
  });
  ok("limit larger than length does not over-spawn", mx <= 2);
}

// isRetryableRpcResult: transient vs deterministic.
ok("success not retried", isRetryableRpcResult({ error: null, status: 200 }) === false);
ok("503 retried", isRetryableRpcResult({ error: { message: "unavailable" }, status: 503 }) === true);
ok("429 retried", isRetryableRpcResult({ error: { message: "too many" }, status: 429 }) === true);
ok("500 retried", isRetryableRpcResult({ error: { message: "boom" }, status: 500 }) === true);
ok("network drop (status 0) retried", isRetryableRpcResult({ error: { message: "fetch failed" }, status: 0 }) === true);
ok("404 missing function not retried", isRetryableRpcResult({ error: { code: "PGRST202", message: "not found" }, status: 404 }) === false);
ok("400 query error not retried", isRetryableRpcResult({ error: { code: "42883", message: "bad" }, status: 400 }) === false);
ok("no status + transient message retried", isRetryableRpcResult({ error: { message: "network error" } }) === true);
ok("no status + opaque message not retried", isRetryableRpcResult({ error: { message: "nope" } }) === false);

// withRpcRetry: rides out a transient failure, gives up on a hard one.
{
  let calls = 0;
  const res = await withRpcRetry(
    () => {
      calls++;
      return Promise.resolve(
        calls < 2
          ? { error: { message: "unavailable" }, status: 503 }
          : { error: null, status: 200, data: "ok" },
      );
    },
    { retries: 2, baseDelayMs: 1 },
  );
  ok("retries a 503 then succeeds", res.error === null && calls === 2);
}
{
  let calls = 0;
  const res = await withRpcRetry(
    () => {
      calls++;
      return Promise.resolve({ error: { code: "PGRST202", message: "not found" }, status: 404 });
    },
    { retries: 2, baseDelayMs: 1 },
  );
  ok("does not retry a 404", res.status === 404 && calls === 1);
}
{
  let calls = 0;
  const res = await withRpcRetry(
    () => {
      calls++;
      return Promise.resolve({ error: { message: "unavailable" }, status: 503 });
    },
    { retries: 2, baseDelayMs: 1 },
  );
  ok("gives up after bounded retries (1 + 2)", res.status === 503 && calls === 3);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
