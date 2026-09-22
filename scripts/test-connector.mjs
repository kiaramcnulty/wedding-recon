#!/usr/bin/env node
/** Framework-free contract tests for the read-only connector rules. */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { authenticateConnectorKey, sha256Hex } from "../lib/connectors/auth.ts";
import { createConnectorCursor, parseConnectorCursor } from "../lib/connectors/cursor.ts";
import { distanceMiles } from "../lib/connectors/locations.ts";
import {
  acquireBoundedPages,
  budgetAssessment,
  compareConnectorRanked,
  effectivePublicFilters,
} from "../lib/connectors/rules.ts";

let pass = 0;
let fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`);
  }
}

console.log("\nauthentication and cursors\n");
const key = "test-connector-key";
eq("valid hashed key", authenticateConnectorKey(key, [sha256Hex(key)]).ok, true);
eq("invalid key", authenticateConnectorKey("wrong", [sha256Hex(key)]), { ok: false, reason: "invalid" });
eq("missing key", authenticateConnectorKey(null, [sha256Hex(key)]), { ok: false, reason: "missing" });
eq("missing server hashes fails closed", authenticateConnectorKey(key, []), { ok: false, reason: "misconfigured" });

process.env.CONNECTOR_CURSOR_SECRET = "a-long-test-secret-that-never-ships";
const cursor = createConnectorCursor({ kind: "vendors", query: "query-hash", snapshot: "snapshot", offset: 10 }, 1_000);
eq("cursor round trip", parseConnectorCursor(cursor, { kind: "vendors", query: "query-hash" }, 1_001)?.offset, 10);
eq("cursor is query-bound", parseConnectorCursor(cursor, { kind: "vendors", query: "other" }, 1_001), null);
eq("cursor expires", parseConnectorCursor(cursor, { kind: "vendors", query: "query-hash" }, 62_000), null);

console.log("\nevidence and pricing rules\n");
eq(
  "dirty derived fields are suppressed but a published override remains",
  effectivePublicFilters({
    base_filters: { price_min: 3000, setting: ["mountain"] },
    filter_overrides: { setting: ["garden"] },
    filters_dirty_at: "2026-09-20T00:00:00Z",
  }),
  { setting: ["garden"] },
);
eq(
  "clean published overrides win without erasing other extracted values",
  effectivePublicFilters({
    base_filters: { price_min: 3000, setting: ["mountain"] },
    filter_overrides: { setting: ["garden"] },
    filters_dirty_at: null,
  }),
  { price_min: 3000, setting: ["garden"] },
);
eq(
  "range overlap discloses values above the ceiling",
  budgetAssessment(4000, 12000, "range", 6000),
  "Possible overlap, but some of the reported range exceeds the budget ceiling.",
);
eq(
  "starting price stays an unknown final total",
  budgetAssessment(3500, null, "starting_at", 4000),
  "The starting floor is within the ceiling, but the final total is unknown.",
);

console.log("\nranking and bounded acquisition\n");
const ranked = [
  { id: "verified-partial", rank: 0, verified: true, matched: 0.5, qScore: 0, priced: true, photo: true, distance: 1 },
  { id: "plain-full", rank: 1, verified: false, matched: 1, qScore: 0, priced: false, photo: false, distance: 9 },
  { id: "verified-full", rank: 1, verified: true, matched: 1, qScore: 0, priced: false, photo: false, distance: 10 },
].sort(compareConnectorRanked);
eq(
  "full tier stays above verified partial; verification reorders only within tier",
  ranked.map((row) => row.id),
  ["verified-full", "plain-full", "verified-partial"],
);

const source = Array.from({ length: 1_201 }, (_, index) => index + 1);
const acquired = await acquireBoundedPages(
  async (after, size) => source.slice(after ?? 0, (after ?? 0) + size),
  1_000,
  5_000,
);
eq("qualifying rows beyond the first database page are acquired", [acquired.rows.length, acquired.rows.at(-1)], [1201, 1201]);
eq("normal acquisition is complete", acquired.exceeded, false);

const oversized = Array.from({ length: 6_001 }, (_, index) => index + 1);
const bounded = await acquireBoundedPages(
  async (after, size) => oversized.slice(after ?? 0, (after ?? 0) + size),
  1_000,
  5_000,
);
eq("candidate safety bound is explicit", bounded.exceeded, true);

console.log("\nlocation and published contract\n");
eq("Denver to Boulder straight-line distance is stable", Math.round(distanceMiles({ lat: 39.7392, lng: -104.9903 }, { lat: 40.015, lng: -105.2705 })), 24);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const openapi = readFileSync(resolve(root, "lib/connectors/openapi.ts"), "utf8");
eq("OpenAPI declares 3.0.3", openapi.includes('openapi: "3.0.3"'), true);
eq("OpenAPI publishes all operation IDs", [
  "getWeddingReconCapabilities",
  "searchWeddingVendors",
  "getWeddingVendor",
].every((id) => openapi.includes(`operationId: "${id}"`)), true);
eq("API key is header-based", openapi.includes('name: "X-API-Key"'), true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
