import { NextResponse } from "next/server";
import { requireOwnerAccount } from "@/lib/api";
import { listAuditEntries } from "@/lib/rank-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  return NextResponse.json(
    { entries: await listAuditEntries(40) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
