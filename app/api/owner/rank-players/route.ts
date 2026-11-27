import { NextResponse } from "next/server";
import { requireOwnerAccount } from "@/lib/api";
import { listPlayersWithPermissions, listRankRecords } from "@/lib/rank-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const [players, ranks] = await Promise.all([
    listPlayersWithPermissions(),
    listRankRecords(),
  ]);

  return NextResponse.json(
    { players, ranks: ranks.filter((rank) => !rank.deletedAt) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
