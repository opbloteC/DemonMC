import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api";
import { countRows } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAnyPermission(["staff.dashboard.view", "staff_panel.access"]);
  if (auth.response) return auth.response;

  return NextResponse.json(
    { counts: await countRows(), user: auth.user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
