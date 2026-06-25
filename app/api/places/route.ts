import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
}

/**
 * Lightweight name-match relevance so DB vendors and Google predictions can be
 * blended into one list independent of source (Google exposes no numeric score
 * to merge on). Runs in-memory on a handful of candidates, so it's effectively
 * free.
 */
function scoreMatch(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}`).test(n)) return 60;
  if (n.includes(q)) return 40;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  const matched = tokens.filter((t) => n.includes(t)).length;
  return (matched / tokens.length) * 30;
}

/**
 * GET /api/places?q=<query>
 *   -> Blended autocomplete: existing Wedding Recon vendors (so people attach
 *      recon to a shared record instead of duplicating it) + Google Places
 *      predictions, deduped by google_place_id and sorted by name relevance.
 *      Returns SearchSuggestion[].
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
    // the added DB lookup doesn't extend the dropdown's latency.
    const supabase = await createClient();
    const dbPromise = supabase
      .from("vendors")
      .select("id, name, vendor_type, city, address_text, google_place_id, source")
      .ilike("name", `%${query}%`)
      .limit(8);

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

    const [dbResult, googleRes] = await Promise.all([dbPromise, googlePromise]);

    // Existing vendors → suggestions.
    const dbRows = dbResult.data ?? [];
    const existing: SearchSuggestion[] = dbRows.map((v) => ({
      kind: "existing",
      vendorId: v.id as string,
      vendorType: v.vendor_type as string,
      source: v.source as "google" | "user" | "seed",
      primaryText: v.name as string,
      secondaryText:
        (v.address_text as string | null) ?? (v.city as string | null) ?? "",
    }));
    // Collapse a Google prediction into the existing record when we already
    // have that exact business (matched by Google place_id).
    const knownPlaceIds = new Set(
      dbRows.map((v) => v.google_place_id).filter(Boolean) as string[],
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
    const merged = [...existing, ...google]
      .map((s) => ({ s, score: scoreMatch(s.primaryText, query) }))
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
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
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
      };

      return NextResponse.json(details);
    } catch (err) {
      console.error("[places] details fetch failed", err);
      return NextResponse.json(null);
    }
  }

  return NextResponse.json({ error: "Provide ?q= or ?placeId=" }, { status: 400 });
}
