"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CATEGORIES,
  usesServiceRegion,
  type CategoryMeta,
  type VendorType,
} from "@/lib/constants/categories";

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
//
// Both families gain a soft "flashlight" glow for SERVICE-REGION categories —
// see the service-area halo note below.

// Single pin: 30px visual inside a 36px box (3px margin = shadow room).
const PIN_BOX = 36;
// Selected pin: the same disc grown, plus a category-colored ring around it, in a
// 52px box. Sized so the pin whose preview card is open is unmistakable among its
// neighbours at a glance — a subtle scale-up wasn't readable enough.
const SELECTED_BOX = 52;
// Cluster disc: larger, 34px visual inside a 48px box.
const CLUSTER_BOX = 48;

// Disc radii, constant across box sizes — only the surrounding room changes.
const DISC_R = 14;
const SELECTED_DISC_R = 18;
const SELECTED_RING_R = 23; // outermost ring of the selected pin
const CLUSTER_R = 17;

// --- Service-area halo -----------------------------------------------------
//
// A service-region vendor is not *at* its pin the way a venue is — the point is
// their base and they travel to you, and for the home-based ones it is often
// only a city centroid. So those pins get a soft radial glow spilling out of the
// disc: light reaching into the surrounding area, which is the fact the pin is
// trying to convey.
//
// Which categories those are comes from `usesServiceRegion` — the same list that
// decides whether Add Recon asks for a service region. Never re-derive it here.
//
// Deliberately edgeless. The other two pin signals are hard-edged and must stay
// separable at a glance — a DASHED disc outline means "approximate address" and
// a crisp ring means "this pin's card is open". A gradient that never resolves
// into a border cannot be mistaken for either, and it also survives a map where
// most pins carry it (only 3 of 12 categories are fixed-location, so the halo is
// texture as much as it is a badge — hence the low peak alpha).
//
// Because the halo is a pure function of vendor_type, it is baked into the same
// image ids rather than added as a variant axis: the map keeps asking for
// `pin-flowers-solid` and simply gets a glowing one. No layer, filter, or
// feature-property change anywhere in vendor-map.tsx.
const HALO_PIN_BOX = 48;
const HALO_SELECTED_BOX = 64;
const HALO_CLUSTER_BOX = 60;
/** Peak glow opacity, held from the disc edge before it falls away. */
const HALO_ALPHA = 0.4;

// Render at 2× so icons stay crisp on retina screens; addImage told pixelRatio 2.
const DPR = 2;

/** Does this category's pin carry the service-area glow? */
function hasHalo(vendorType: string): boolean {
  return usesServiceRegion(vendorType as VendorType);
}

/** Box sizes for a category, widened to make room for the glow when it has one. */
function boxes(vendorType: string) {
  return hasHalo(vendorType)
    ? { pin: HALO_PIN_BOX, selected: HALO_SELECTED_BOX, cluster: HALO_CLUSTER_BOX }
    : { pin: PIN_BOX, selected: SELECTED_BOX, cluster: CLUSTER_BOX };
}

/**
 * Stable image id for a category + precision variant, e.g. "pin-venue-dashed";
 * `selected` picks the emphasized variant used for the pin whose preview is open
 * ("pin-venue-dashed-selected").
 */
export function pinImageId(
  vendorType: string,
  approximate: boolean,
  selected = false,
): string {
  const type = vendorType in CATEGORIES ? vendorType : "other";
  return `pin-${type}-${approximate ? "dashed" : "solid"}${selected ? "-selected" : ""}`;
}

/** Stable image id for a category's cluster disc, e.g. "cluster-photos". */
export function clusterImageId(vendorType: string): string {
  const type = vendorType in CATEGORIES ? vendorType : "other";
  return `cluster-${type}`;
}

/** Wrap inner SVG markup in a square document of the given box size. */
function svgDoc(box: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">${inner}</svg>`;
}

/**
 * The glow: a radial gradient in the category color, flat at full strength out
 * to the edge of whatever it sits behind (`innerR`, in px), then falling away to
 * nothing at the edge of the box. Drawn as its own canvas layer so it can skip
 * the drop shadow the disc gets — a blurred dark copy under a soft glow reads as
 * grime rather than depth.
 *
 * The gradient id is namespaced by category, and that is load-bearing rather
 * than tidiness. SVG ids resolve per DOCUMENT: each rasterized pin is its own
 * data-URI document so a fixed id would be safe there, but `vendorPinMarkup`
 * injects this markup INLINE into the page, where a second pin sharing the id
 * would silently paint itself in the first one's color.
 */
function haloMarkup(
  box: number,
  colorHex: string,
  innerR: number,
  gradientId: string,
): string {
  const c = box / 2;
  const r = c - 1; // 1px breathing room inside the box
  const inner = innerR / r;
  const mid = inner + (1 - inner) * 0.5;
  const stop = (offset: number, alpha: number) =>
    `<stop offset="${offset.toFixed(3)}" stop-color="${colorHex}" stop-opacity="${alpha}" />`;
  return `<defs><radialGradient id="${gradientId}">${stop(0, HALO_ALPHA)}${stop(
    inner,
    HALO_ALPHA,
  )}${stop(mid, HALO_ALPHA * 0.45)}${stop(1, 0)}</radialGradient></defs>
    <circle cx="${c}" cy="${c}" r="${r}" fill="url(#${gradientId})" />`;
}

/** Document-unique id for one category + box size's glow gradient. */
function haloId(vendorType: string, box: number): string {
  return `wr-halo-${vendorType}-${box}`;
}

/** A single pin: colored disc + centered icon, solid or dashed outline. */
function pinMarkup(
  box: number,
  colorHex: string,
  iconSvg: string,
  dashed: boolean,
): string {
  const c = box / 2;
  return `<circle cx="${c}" cy="${c}" r="${DISC_R}" fill="${colorHex}" stroke="#ffffff" stroke-width="2"${
    dashed ? ' stroke-dasharray="3 3"' : ""
  } />
    <g transform="translate(${c - 7},${c - 7})">${iconSvg}</g>`;
}

/**
 * The SELECTED pin: the same disc grown, wrapped in a translucent
 * category-colored ring, with a thicker white casing between them. Reads as
 * "this is the one the card is about" without changing the pin's color language.
 */
function selectedPinMarkup(
  box: number,
  colorHex: string,
  iconSvg: string,
  dashed: boolean,
): string {
  const c = box / 2;
  return `<circle cx="${c}" cy="${c}" r="${SELECTED_RING_R}" fill="${colorHex}" fill-opacity="0.18" />
    <circle cx="${c}" cy="${c}" r="21" fill="none" stroke="${colorHex}" stroke-width="2.5" stroke-opacity="0.9" />
    <circle cx="${c}" cy="${c}" r="${SELECTED_DISC_R}" fill="${colorHex}" stroke="#ffffff" stroke-width="3"${
      dashed ? ' stroke-dasharray="4 3"' : ""
    } />
    <g transform="translate(${c - 9},${c - 9})">${iconSvg}</g>`;
}

/** A cluster disc: larger colored disc + icon in the upper half. */
function clusterMarkup(box: number, colorHex: string, iconSvg: string): string {
  const c = box / 2;
  return `<circle cx="${c}" cy="${c}" r="${CLUSTER_R}" fill="${colorHex}" stroke="#ffffff" stroke-width="2" />
    <g transform="translate(${c - 7},${c - 16})">${iconSvg}</g>`;
}

/** One white-on-color Lucide glyph, as markup, at the size a pin draws it. */
function glyph(icon: CategoryMeta["icon"], size: number): string {
  return renderToStaticMarkup(
    createElement(icon, { size, color: "#ffffff", strokeWidth: 2.5 }),
  );
}

/**
 * Complete markup for one vendor pin at its natural box size — the same disc,
 * glow and dashed-outline treatment the Explore map draws, for surfaces that
 * place a single DOM marker instead of a symbol layer (the vendor page's
 * mini-map). Sharing this is what keeps that pin pixel-identical to the one the
 * user just tapped on Explore.
 */
export function vendorPinMarkup(
  vendorType: string,
  { approximate = false }: { approximate?: boolean } = {},
): { svg: string; box: number; halo: boolean } {
  const type = (vendorType in CATEGORIES ? vendorType : "other") as VendorType;
  const meta = CATEGORIES[type];
  const box = boxes(type).pin;
  const halo = hasHalo(type);
  const pin = pinMarkup(box, meta.colorHex, glyph(meta.icon, 14), approximate);
  const inner = halo
    ? haloMarkup(box, meta.colorHex, DISC_R, haloId(type, box)) + pin
    : pin;
  // `halo` is reported so a DOM-marker caller can skip the CSS drop shadow that
  // stands in for the canvas one: a shadow cast by the glow reads as grime, the
  // same reason the rasterizer draws that layer unshadowed.
  return { svg: svgDoc(box, inner), box, halo };
}

/** One canvas layer: an SVG document, and whether it gets the pin drop shadow. */
interface Layer {
  svg: string;
  shadow: boolean;
}

/** Decode an SVG string to an <img> ready for drawImage. */
async function loadSvg(svg: string): Promise<HTMLImageElement> {
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("map image failed to load"));
    img.src = url;
  });
  return img;
}

/**
 * Draw the given layers (in order) onto one canvas and read the pixels back.
 * Only the layers that ask for it get the drop shadow, which is what lets the
 * service-area glow sit behind a shadowed disc without being shadowed itself.
 */
async function rasterize(layers: Layer[], box: number): Promise<ImageData> {
  const images = await Promise.all(layers.map((l) => loadSvg(l.svg)));

  const canvas = document.createElement("canvas");
  canvas.width = box * DPR;
  canvas.height = box * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.scale(DPR, DPR);

  images.forEach((img, i) => {
    if (layers[i].shadow) {
      // Soft drop shadow so icons read over the basemap (former CSS box-shadow).
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.drawImage(img, 0, 0, box, box);
  });
  return ctx.getImageData(0, 0, box * DPR, box * DPR);
}

/**
 * Register every category's pin (solid + dashed, plain + selected) and cluster
 * disc on the map. Idempotent — skips ids already added, so it's safe to call
 * again after a style reload. Awaits all rasterization before resolving so no
 * layer ever references a missing image.
 */
export async function registerPinImages(
  map: import("maplibre-gl").Map,
): Promise<void> {
  /** Rasterize one image's layers and register it, unless it already exists. */
  const add = async (id: string, layers: Layer[], box: number) => {
    if (map.hasImage(id)) return;
    const data = await rasterize(layers, box);
    if (map.hasImage(id)) return; // lost a race — someone else added it
    map.addImage(id, data, { pixelRatio: DPR });
  };

  // Kick every rasterization off at once; image decodes then run concurrently
  // instead of blocking the first pin render on ~24 sequential awaits.
  const jobs: Promise<void>[] = [];
  for (const [type, meta] of Object.entries(CATEGORIES)) {
    const iconSvg = glyph(meta.icon, 14);
    // The selected pin's disc is bigger, so its glyph is drawn bigger to match.
    const selectedIconSvg = glyph(meta.icon, 18);
    const halo = hasHalo(type);
    const box = boxes(type);

    /**
     * Layers for one image: the glow first (service-area categories only), then
     * the pin itself. `innerR` is the outer radius of the shape the glow sits
     * behind, so the falloff always begins exactly where that shape stops.
     */
    const layers = (size: number, innerR: number, pin: string): Layer[] => {
      const pinLayer: Layer = { svg: svgDoc(size, pin), shadow: true };
      if (!halo) return [pinLayer];
      return [
        {
          svg: svgDoc(
            size,
            haloMarkup(size, meta.colorHex, innerR, haloId(type, size)),
          ),
          shadow: false,
        },
        pinLayer,
      ];
    };

    for (const dashed of [false, true]) {
      jobs.push(
        add(
          pinImageId(type, dashed),
          layers(box.pin, DISC_R, pinMarkup(box.pin, meta.colorHex, iconSvg, dashed)),
          box.pin,
        ),
      );
      jobs.push(
        add(
          pinImageId(type, dashed, true),
          layers(
            box.selected,
            SELECTED_RING_R,
            selectedPinMarkup(box.selected, meta.colorHex, selectedIconSvg, dashed),
          ),
          box.selected,
        ),
      );
    }
    jobs.push(
      add(
        clusterImageId(type),
        layers(box.cluster, CLUSTER_R, clusterMarkup(box.cluster, meta.colorHex, iconSvg)),
        box.cluster,
      ),
    );
  }
  await Promise.all(jobs);
}
