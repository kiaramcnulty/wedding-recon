#!/usr/bin/env node
/**
 * Compile the cluster-bubble label with MapLibre's OWN expression parser and
 * evaluate it against realistic cluster features.
 *
 *   node scripts/test-cluster-label.mjs
 *
 * A map style expression fails at runtime, inside the map, with no type
 * checking and — without an explicit `map.on("error")` handler — no console
 * output either. This compiles it the same way MapLibre does, so a malformed
 * label is caught here instead of silently rendering a blank bubble.
 *
 * Keep the expression below in step with `clusterLabel` in
 * components/map/vendor-map.tsx.
 */
import { createPropertyExpression } from "@maplibre/maplibre-gl-style-spec";

const base = [
  "case",
  ["==", ["get", "matched"], ["get", "point_count"]],
  ["get", "point_count_abbreviated"],
  [">", ["get", "matched"], 0],
  ["to-string", ["get", "matched"]],
  ["get", "point_count_abbreviated"],
];
const label = (capped) => (capped ? ["concat", base, "+"] : base);

// The spec for symbol text-field.
const spec = {
  type: "formatted",
  "property-type": "data-driven",
  expression: { interpolated: false, parameters: ["zoom", "feature"] },
};

const cases = [
  ["all matched, uncapped", false, { point_count: 678, point_count_abbreviated: "678", matched: 678 }],
  ["all matched, CAPPED", true, { point_count: 999, point_count_abbreviated: "999", matched: 999 }],
  ["abbreviated + CAPPED", true, { point_count: 1200, point_count_abbreviated: "1.2k", matched: 1200 }],
  ["partial matches, CAPPED", true, { point_count: 999, point_count_abbreviated: "999", matched: 42 }],
  ["no matches, CAPPED", true, { point_count: 999, point_count_abbreviated: "999", matched: 0 }],
];

let bad = 0;
for (const [name, capped, properties] of cases) {
  const compiled = createPropertyExpression(label(capped), spec);
  if (compiled.result === "error") {
    bad++;
    console.log(`FAIL  ${name}`);
    for (const e of compiled.value) console.log(`        ${e.key}: ${e.message}`);
    continue;
  }
  const out = compiled.value.evaluate({ zoom: 5 }, { properties });
  console.log(`ok    ${name.padEnd(24)} -> "${out.toString()}"`);
}
console.log(bad ? `\n${bad} FAILED` : "\nexpression compiles and evaluates in every case");
process.exit(bad ? 1 : 0);
