import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight health check. Also used by the daily keep-alive cron to issue a
 * real request against Supabase so the free-tier project doesn't pause during
 * the low-traffic cold-start period.
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

  return NextResponse.json({ status: "ok", db, time: new Date().toISOString() });
}
