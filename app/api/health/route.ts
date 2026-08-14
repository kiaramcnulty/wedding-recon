import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight health check — a real query against Supabase, used two ways:
 *   1. an uptime monitor (UptimeRobot/Better Stack) pings it every minute so a
 *      DB outage pages you within ~2 min instead of being found by opening the
 *      app; and
 *   2. the daily keep-alive cron issues a request so the free-tier project does
 *      not pause during low-traffic periods.
 *
 * It returns HTTP 503 (not 200-with-a-body) when the DB check fails, so even a
 * dumb status-only monitor catches the outage — the previous always-200 shape
 * would have stayed GREEN through the connection-exhaustion incident that took
 * the map down. The JSON body still carries `db` for keyword monitors and the
 * keepalive's own grep, and no-store keeps any layer from serving a cached "ok".
 */
export async function GET() {
  let db: "ok" | "error" = "ok";
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("vendors").select("id").limit(1);
    if (error) db = "error";
  } catch {
    db = "error";
  }

  const ok = db === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "error", db, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
