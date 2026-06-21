import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface AutocompleteResult {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

interface PlaceDetails {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * GET /api/places?q=<query>
 *   -> Google Places Autocomplete (New API). Returns AutocompleteResult[].
 *
 * GET /api/places?placeId=<id>
 *   -> Google Place Details. Returns PlaceDetails | null.
 *
 * If GOOGLE_PLACES_API_KEY is absent the route returns gracefully (HTTP 200)
 * with an empty list / null so the manual-entry path still works.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q");
  const placeId = searchParams.get("placeId");

  // ── Autocomplete ──────────────────────────────────────────────────────────
  if (q !== null) {
    if (!apiKey || !q.trim()) {
      return NextResponse.json([] as AutocompleteResult[]);
    }

    try {
      const res = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
          },
          body: JSON.stringify({ input: q.trim() }),
        }
      );

      if (!res.ok) {
        console.error("[places] autocomplete error", res.status, await res.text());
        return NextResponse.json([] as AutocompleteResult[]);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const suggestions: AutocompleteResult[] = (
        data?.suggestions ?? []
      )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((s: any) => s?.placePrediction)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => ({
          placeId: s.placePrediction.placeId as string,
          primaryText:
            s.placePrediction.structuredFormat?.mainText?.text ??
            s.placePrediction.text?.text ??
            "",
          secondaryText:
            s.placePrediction.structuredFormat?.secondaryText?.text ?? "",
        }));

      return NextResponse.json(suggestions);
    } catch (err) {
      console.error("[places] autocomplete fetch failed", err);
      return NextResponse.json([] as AutocompleteResult[]);
    }
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
        }
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
