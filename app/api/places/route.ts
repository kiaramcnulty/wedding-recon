import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreVendorMatch, searchVendors } from "@/lib/search/vendors";

export const dynamic = "force-dynamic";

/**
 * Cap on existing-vendor rows shown in the blended dropdown, so a broad query
 * ("Denver") can't crowd Google predictions out of the 8 visible slots.
 */
const MAX_EXISTING = 6;

/** Ranked vendor matches to consider — the extras still feed the place_id dedup. */
const MAX_MATCHES = 24;

export type SearchSuggestion =
  | {
      kind: "existing";
      vendorId: string;
      vendorType: string;
      source: "google" | "user" | "seed";
      primaryText: string;
      secondaryText: string;
    }
  | {
      kind: "google";
      placeId: string;
      primaryText: string;
      secondaryText: string;
    };

interface PlaceDetails {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
}

/**
 * GET /api/places?q=<query>
 *   -> Blended autocomplete: existing Wedding Recon vendors (so people attach
 *      recon to a shared record instead of duplicating it) + Google Places
 *      predictions, deduped by google_place_id and sorted by name relevance.
 *      Returns SearchSuggestion[].
 *
 *      The vendor half runs through `lib/search/vendors.ts` — the same matcher
 *      and scorer the Explore bar uses — so both search boxes find a vendor by
 *      name, street address, or city, per-token rather than as one contiguous
 *      string. Google predictions are scored with the same function (they carry
 *      no numeric score of their own), which is what lets the two sources merge
 *      into one ranked list.
 *
 * GET /api/places?placeId=<id>
 *   -> Google Place Details. Returns PlaceDetails | null.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q");
  const placeId = searchParams.get("placeId");

  // ── Autocomplete (existing vendors + Google) ──────────────────────────────
  if (q !== null) {
    const query = q.trim();
    if (!query) return NextResponse.json([] as SearchSuggestion[]);

    // Existing community vendors and Google predictions, fetched in parallel so
    // the vendor lookup doesn't extend the dropdown's latency. Keep the full
    // ranked match set (not just the rows we'll show) so the place_id dedup below
    // sees every vendor we already have — a Google twin of a vendor that ranked
    // out of the visible rows would otherwise slip through as a duplicate. The
    // helper no-ops on a too-short or punctuation-only query, and Google
    // predictions still run either way.
    const supabase = await createClient();
    const vendorPromise = searchVendors(supabase, query, { limit: MAX_MATCHES });

    const googlePromise = apiKey
      ? fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
          },
          body: JSON.stringify({ input: query }),
        }).catch(() => null)
      : Promise.resolve(null);

    const [vendorMatches, googleRes] = await Promise.all([
      vendorPromise,
      googlePromise,
    ]);

    // Existing vendors → suggestions, keeping the score the matcher assigned
    // (name matches rank above rows that only matched on address/city).
    const existing = vendorMatches.slice(0, MAX_EXISTING).map((v) => ({
      score: v.score,
      s: {
        kind: "existing",
        vendorId: v.id,
        vendorType: v.vendorType,
        source: v.source,
        primaryText: v.name,
        secondaryText: v.addressText ?? v.city ?? "",
      } as SearchSuggestion,
    }));
    // Collapse a Google prediction into the existing record when we already
    // have that exact business (matched by Google place_id).
    const knownPlaceIds = new Set(
      vendorMatches.map((v) => v.googlePlaceId).filter(Boolean) as string[],
    );

    // Google predictions (skip ones already represented by an existing vendor).
    let google: SearchSuggestion[] = [];
    if (googleRes && googleRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await googleRes.json();
      google = (data?.suggestions ?? [])
        .filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s: any) =>
            s?.placePrediction && !knownPlaceIds.has(s.placePrediction.placeId),
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => ({
          kind: "google" as const,
          placeId: s.placePrediction.placeId as string,
          primaryText:
            s.placePrediction.structuredFormat?.mainText?.text ??
            s.placePrediction.text?.text ??
            "",
          secondaryText:
            s.placePrediction.structuredFormat?.secondaryText?.text ?? "",
        }));
    } else if (googleRes && !googleRes.ok) {
      console.error(
        "[places] autocomplete error",
        googleRes.status,
        await googleRes.text(),
      );
    }

    // Blend by name relevance, independent of source.
    const merged = [
      ...existing,
      ...google.map((s) => ({ s, score: scoreVendorMatch(s.primaryText, query) })),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.s);

    return NextResponse.json(merged);
  }

  // ── Place Details ─────────────────────────────────────────────────────────
  if (placeId !== null) {
    if (!apiKey || !placeId.trim()) {
      return NextResponse.json(null);
    }

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId.trim())}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "id,displayName,formattedAddress,location,websiteUri",
          },
        },
      );

      if (!res.ok) {
        console.error("[places] details error", res.status, await res.text());
        return NextResponse.json(null);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const details: PlaceDetails = {
        name: data?.displayName?.text ?? "",
        address: data?.formattedAddress ?? null,
        lat: data?.location?.latitude ?? null,
        lng: data?.location?.longitude ?? null,
        website: data?.websiteUri ?? null,
      };

      return NextResponse.json(details);
    } catch (err) {
      console.error("[places] details fetch failed", err);
      return NextResponse.json(null);
    }
  }

  return NextResponse.json({ error: "Provide ?q= or ?placeId=" }, { status: 400 });
}
