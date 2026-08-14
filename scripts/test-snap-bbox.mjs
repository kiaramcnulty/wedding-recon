#!/usr/bin/env node
/**
 * Tests for snapBbox (lib/map/viewport.ts) — the grid snap that makes the
 * /api/map/vendors edge cache worth having.
 *
 *   node scripts/test-snap-bbox.mjs
 *
 * The property that matters: near-identical viewports must resolve to the SAME
 * box, or the CDN cache key never repeats and the hit rate is ~0%. It must also
 * always CONTAIN the input (never drop a pin in view) and be deterministic
 * (float noise would defeat the string cache key).
 */
import { bboxForView, padBbox, snapBbox } from "../lib/map/viewport.ts";

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) passed++;
  else {
    failed++;
    console.error("FAIL:", name);
  }
}
const eq = (a, b) =>
  a.minLng === b.minLng &&
  a.minLat === b.minLat &&
  a.maxLng === b.maxLng &&
  a.maxLat === b.maxLat;
const contains = (outer, inner) =>
  outer.minLng <= inner.minLng &&
  outer.minLat <= inner.minLat &&
  outer.maxLng >= inner.maxLng &&
  outer.maxLat >= inner.maxLat;

// THE cache-hit property: the default Denver view on three common phone widths
// must snap to one identical box (so all three share a cache key).
{
  const lng = -104.9903;
  const lat = 39.7392;
  const zoom = 9;
  const boxes = [375, 390, 414].map((w) =>
    snapBbox(padBbox(bboxForView(lng, lat, zoom, w, 844), 0.5)),
  );
  ok("phone widths on the same view snap to ONE box", eq(boxes[0], boxes[1]) && eq(boxes[1], boxes[2]));
  ok("snapped box is clean (no float noise in the key)", Number.isFinite(boxes[0].minLng) && String(boxes[0].minLng).length < 12);
}

// Containment + non-degeneracy across a range of zooms.
for (const zoom of [4, 7, 9, 12, 15]) {
  const raw = padBbox(bboxForView(-104.99, 39.74, zoom, 390, 844), 0.5);
  const snapped = snapBbox(raw);
  ok(`z${zoom}: snapped contains the input`, contains(snapped, raw));
  ok(`z${zoom}: snapped is non-degenerate`, snapped.minLng < snapped.maxLng && snapped.minLat < snapped.maxLat);
  ok(`z${zoom}: deterministic`, eq(snapBbox(raw), snapped));
}

// A finer view snaps to a finer grid than a coarse one (step scales with zoom).
{
  const coarse = snapBbox(padBbox(bboxForView(-104.99, 39.74, 5, 390, 844), 0.5));
  const fine = snapBbox(padBbox(bboxForView(-104.99, 39.74, 14, 390, 844), 0.5));
  const coarseSpan = coarse.maxLng - coarse.minLng;
  const fineSpan = fine.maxLng - fine.minLng;
  ok("zoomed-in view produces a much smaller box", fineSpan < coarseSpan);
}

// A pan smaller than the grid step lands on the same cell (cache still hits).
{
  const a = snapBbox(padBbox(bboxForView(-104.99, 39.74, 9, 390, 844), 0.5));
  const b = snapBbox(padBbox(bboxForView(-104.98, 39.74, 9, 390, 844), 0.5)); // ~0.01 deg pan
  // Not guaranteed for every pan (a pan can cross a boundary), but this small
  // one from the default center should not.
  ok("a sub-cell pan keeps the same box", eq(a, b));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
