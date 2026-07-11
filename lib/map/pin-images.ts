"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CATEGORIES } from "@/lib/constants/categories";

// Rasterizes each vendor-category pin to a bitmap ONCE and registers it with the
// map, so the clustered symbol layer can reference it by id (`icon-image`).
// Replaces the old per-pin DOM marker (which re-ran renderToStaticMarkup on every
// refresh) — here the ~12 categories × {solid, dashed} are drawn a single time at
// map load. The look (colored disc + white Lucide icon + white outline + soft
// shadow; dashed outline for approximate locations) matches the former markers.

// 30px visual pin inside a 36px box; the 3px margin all around is shadow room.
const BOX = 36;
// Render at 2× so pins stay crisp on retina screens; addImage is told pixelRatio 2.
const DPR = 2;

/** Stable image id for a category + precision variant, e.g. "pin-venue-dashed". */
export function pinImageId(vendorType: string, approximate: boolean): string {
  const type = vendorType in CATEGORIES ? vendorType : "other";
  return `pin-${type}-${approximate ? "dashed" : "solid"}`;
}

/** SVG markup for one pin: colored disc + centered icon, solid or dashed outline. */
function pinSvg(colorHex: string, iconSvg: string, dashed: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BOX}" height="${BOX}" viewBox="0 0 ${BOX} ${BOX}">
    <circle cx="18" cy="18" r="14" fill="${colorHex}" stroke="#ffffff" stroke-width="2"${
      dashed ? ' stroke-dasharray="3 3"' : ""
    } />
    <g transform="translate(11,11)">${iconSvg}</g>
  </svg>`;
}

/** Load an SVG string into an <img>, draw it (with shadow) to a canvas, read pixels. */
async function svgToImageData(svg: string): Promise<ImageData> {
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("pin image failed to load"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = BOX * DPR;
  canvas.height = BOX * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.scale(DPR, DPR);
  // Soft drop shadow so pins read over the basemap (former CSS box-shadow).
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.drawImage(img, 0, 0, BOX, BOX);
  return ctx.getImageData(0, 0, BOX * DPR, BOX * DPR);
}

/**
 * Register every category pin (solid + dashed) on the map. Idempotent — skips
 * ids already added, so it's safe to call again after a style reload. Awaits all
 * rasterization before resolving so the symbol layer never references a missing
 * image.
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
      if (map.hasImage(id)) continue;
      const imageData = await svgToImageData(pinSvg(meta.colorHex, iconSvg, dashed));
      map.addImage(id, imageData, { pixelRatio: DPR });
    }
  }
}
