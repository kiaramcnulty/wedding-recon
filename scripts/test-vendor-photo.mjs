#!/usr/bin/env node
// Exercise the real handlers with mocked DB/Google calls: no network or secrets.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import Module, { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import ts from "typescript";

function load(file, dependencies) {
  const filename = resolve(file);
  const mod = new Module(filename);
  mod.require = (name) => {
    assert.ok(name in dependencies, `unexpected dependency: ${name}`);
    return dependencies[name];
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

const id = "0002e6f6-b98b-4184-9884-850f5aedbd58";
const photo = { name: "places/test/photos/test", attrib: null, attribUri: null };
let calls = [];
const db = { from() {
  calls.push("db");
  return {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: { id, google_place_id: "test" } }; },
    update() { calls.push("write"); return this; },
  };
} };
const server = { createServiceRoleClient: () => db };
const route = load("app/api/vendor-photo/[vendorId]/route.ts", {
  "@/lib/supabase/server": server,
  "@/lib/google-photos": {
    getVendorGooglePhotos: async () => [photo, photo],
    refreshVendorGooglePhotos: async () => { throw Error("unexpected rotation"); },
    isValidPhotoName: () => true,
  },
  "@/lib/rate-limit": { checkRateLimit: async () => { calls.push("limit"); return true; } },
});
const { GET } = route;
assert.equal(route.revalidate, 0, "route stays dynamic without disabling explicit fetch caching");
assert.equal(route.dynamic, undefined);
assert.equal(route.fetchCache, undefined);
const originalFetch = globalThis.fetch;
const originalKey = process.env.GOOGLE_PLACES_API_KEY;
process.env.GOOGLE_PLACES_API_KEY = "test-only";
try {
  globalThis.fetch = async (url, options) => {
    calls.push("google");
    assert.match(url, /^https:\/\/places\.googleapis\.com\/v1\/places\/test\/photos\/test\/media\?maxWidthPx=(300|600|1200)$/);
    assert.equal(options.cache, "force-cache", "media must use the deployment-independent Data Cache");
    assert.equal(options.next.revalidate, 7776000);
    return new Response("image", { headers: { "Content-Type": "image/jpeg" } });
  };
  async function request(suffix, vendorId = id) {
    calls = [];
    return GET({ nextUrl: new URL(`https://example.test/api/vendor-photo/${vendorId}${suffix}`), headers: new Headers() },
      { params: Promise.resolve({ vendorId }) });
  }
  const canonical = `/api/vendor-photo/${id}?i=0&w=600`;
  for (const suffix of ["?i=0&w=600&bust=1", "?w=600&i=0", "?i=00&w=0600", "?%69=0&w=600"]) {
    const res = await request(suffix);
    assert.equal(res.status, 308, suffix);
    assert.equal(res.headers.get("Location"), canonical);
    assert.deepEqual(calls, [], "redirect must not touch rate limit, DB, or Google");
  }
  const defaults = await request("");
  assert.equal(defaults.headers.get("Location"), `/api/vendor-photo/${id}?i=0&w=1200`);
  const uppercase = await request("?i=0&w=600", id.toUpperCase());
  assert.equal(uppercase.headers.get("Location"), canonical);
  assert.deepEqual(calls, []);
  for (const suffix of ["?i=0&i=1&w=600", "?i=0&w=600&w=1200", "?i=2&w=600", "?i=-1&w=600", "?i=0.9&w=600", "?i=0&w=601"]) {
    assert.equal((await request(suffix)).status, 404, suffix);
    assert.deepEqual(calls, []);
  }
  for (const i of [0, 1]) for (const w of [300, 600, 1200]) {
    const res = await request(`?i=${i}&w=${w}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Cache-Control"), /s-maxage=7776000(?:,|$)/);
    assert.deepEqual(calls, ["limit", "db", "google"]);
  }

  // Use Next's real patched fetch + filesystem Data Cache, with no in-memory
  // cache. Recreate the cache client for a second build to verify binary reuse
  // across independent request/build contexts. Only the origin is mocked.
  const require = createRequire(import.meta.url);
  const { IncrementalCache } = require("next/dist/server/lib/incremental-cache");
  const { nodeFs } = require("next/dist/server/lib/node-fs-methods");
  const { createPatchedFetcher } = require("next/dist/server/lib/patch-fetch");
  const workAsyncStorage = new AsyncLocalStorage();
  const workUnitAsyncStorage = new AsyncLocalStorage();
  const dir = await mkdtemp(`${tmpdir()}/vendor-photo-cache-`);
  let downloads = 0;
  const bytes = new Uint8Array([0, 255, 12, 34]);
  globalThis.fetch = createPatchedFetcher(async () => {
    downloads++;
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
  }, { workAsyncStorage, workUnitAsyncStorage });
  try {
    for (const buildId of ["deployment-one", "deployment-two"]) {
      const incrementalCache = new IncrementalCache({
        dev: false, requestHeaders: {}, fs: nodeFs, flushToDisk: true,
        serverDistDir: `${dir}/server`, maxMemoryCacheSize: 0,
        getPrerenderManifest: () => ({ version: 4, routes: {}, dynamicRoutes: {},
          notFoundRoutes: [], preview: { previewModeId: "test" } }),
      });
      const store = { route: "/api/vendor-photo/[vendorId]", isStaticGeneration: false,
        incrementalCache, buildId };
      await workAsyncStorage.run(store, async () => {
        const res = await request("?i=0&w=600");
        assert.equal(res.status, 200);
        assert.equal(res.headers.get("Content-Type"), "image/jpeg");
        assert.deepEqual(new Uint8Array(await res.arrayBuffer()), bytes);
        await Promise.all(Object.values(store.pendingRevalidates ?? {}));
      });
      assert.equal(downloads, 1, `${buildId} must reuse the same upstream response`);
    }
    console.log("Next Data Cache integration passed: two independent build contexts, one upstream download, identical binary bytes.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const { getVendorGooglePhotos } = load("lib/google-photos.ts", { "@/lib/supabase/server": server });
  globalThis.fetch = async () => { calls.push("details"); return Response.json({ photos: [photo] }); };
  for (const [days, refresh] of [[31, false], [89, false], [91, true]]) {
    calls = [];
    const result = await getVendorGooglePhotos({ id, google_place_id: "test", google_photos: [photo],
      google_photos_fetched_at: new Date(Date.now() - days * 86400000).toISOString() });
    assert.equal(result.length, 1);
    assert.equal(calls.includes("details"), refresh, `${days}-day reference cache`);
  }
  console.log("Vendor photo checks passed: canonical URLs, no-cost rejection/redirects, valid widths, 90-day caches.");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
}
