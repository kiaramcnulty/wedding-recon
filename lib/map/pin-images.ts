"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CATEGORIES } from "@/lib/constants/categories";

// Rasterizes vendor-category map icons to bitmaps ONCE and registers them with
// the map, so the symbol layers can reference them by id (`icon-image`).
// Replaces the old per-pin DOM marker (which re-ran renderToStaticMarkup on every
// refresh) — here each category is drawn a single time at map load.
//
// Two image families per category:
//  - pins:     colored disc + white Lucide icon + white outline + soft shadow;
//              dashed outline for approximate locations. Matches the former markers.
//  - clusters: a larger colored disc with the white icon in the UPPER half; the
//              count is drawn by the symbol layer's text below it (icon-above-count).

// Single pin: 30px visual inside a 36px box (3px margin = shadow room).
const PIN_BOX = 36;
// Cluster disc: larger, 34px visual inside a 48px box.
const CLUSTER_BOX = 48;
// Render at 2× so icons stay crisp on retina screens; addImage told pixelRatio 2.
const DPR = 2;

/** Stable image id for a category + precision variant, e.g. "pin-venue-dashed". */
export function pinImageId(vendorType: string, approximate: boolean): string {
  const type = vendorType in CATEGORIES ? vendorType : "other";
  return `pin-${type}-${approximate ? "dashed" : "solid"}`;
}

/** Stable image id for a category's cluster disc, e.g. "cluster-photos". */
export function clusterImageId(vendorType: string): string {
  const type = vendorType in CATEGORIES ? vendorType : "other";
  return `cluster-${type}`;
}

/** SVG for a single pin: colored disc + centered icon, solid or dashed outline. */
function pinSvg(colorHex: string, iconSvg: string, dashed: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_BOX}" height="${PIN_BOX}" viewBox="0 0 ${PIN_BOX} ${PIN_BOX}">
    <circle cx="18" cy="18" r="14" fill="${colorHex}" stroke="#ffffff" stroke-width="2"${
      dashed ? ' stroke-dasharray="3 3"' : ""
    } />
    <g transform="translate(11,11)">${iconSvg}</g>
  </svg>`;
}

/** SVG for a cluster disc: larger colored disc + icon in the upper half. */
function clusterSvg(colorHex: string, iconSvg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CLUSTER_BOX}" height="${CLUSTER_BOX}" viewBox="0 0 ${CLUSTER_BOX} ${CLUSTER_BOX}">
    <circle cx="24" cy="24" r="17" fill="${colorHex}" stroke="#ffffff" stroke-width="2" />
    <g transform="translate(17,8)">${iconSvg}</g>
  </svg>`;
}

/** Load an SVG string into an <img>, draw it (with shadow) to a canvas, read pixels. */
async function svgToImageData(svg: string, box: number): Promise<ImageData> {
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("map image failed to load"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = box * DPR;
  canvas.height = box * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.scale(DPR, DPR);
  // Soft drop shadow so icons read over the basemap (former CSS box-shadow).
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.drawImage(img, 0, 0, box, box);
  return ctx.getImageData(0, 0, box * DPR, box * DPR);
}

/**
 * Register every category's pin (solid + dashed) and cluster disc on the map.
 * Idempotent — skips ids already added, so it's safe to call again after a style
 * reload. Awaits all rasterization before resolving so no layer ever references a
 * missing image.
 */
export async function registerPinImages(
  map: import("maplibre-gl").Map,
): Promise<void> {
  for (const [type, meta] of Object.entries(CATEGORIES)) {
    const iconSvg = renderToStaticMarkup(
      createElement(meta.icon, {
        size: 14,
        color: "#ffffff",
        strokeWidth: 2.5,
      }),
    );

    for (const dashed of [false, true]) {
      const id = pinImageId(type, dashed);
      if (!map.hasImage(id)) {
        const data = await svgToImageData(pinSvg(meta.colorHex, iconSvg, dashed), PIN_BOX);
        map.addImage(id, data, { pixelRatio: DPR });
      }
    }

    const clusterId = clusterImageId(type);
    if (!map.hasImage(clusterId)) {
      const data = await svgToImageData(clusterSvg(meta.colorHex, iconSvg), CLUSTER_BOX);
      map.addImage(clusterId, data, { pixelRatio: DPR });
    }
  }
}
