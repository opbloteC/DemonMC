import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getPublicServerStatus } from "@/lib/server-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { ip } = await getSettings();
  const status = await getPublicServerStatus(ip);
  return NextResponse.json(status, {
    // Public snapshot, already cached server-side for 15s; let the CDN reuse it
    // between polls instead of invoking the function for every visitor.
    headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
  });
}
