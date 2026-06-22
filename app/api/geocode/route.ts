import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "WeddingRecon/1.0 (hello@weddingrecon.com)",
      "Accept-Language": "en",
    },
  });

  if (!res.ok) return NextResponse.json([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();

  return NextResponse.json(
    data.map((item) => ({
      name: item.display_name as string,
      lat: parseFloat(item.lat as string),
      lng: parseFloat(item.lon as string),
    })),
  );
}
