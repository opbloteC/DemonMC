import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import {
  assignPlayerRank,
  getPlayerWithPermissions,
  RankAdminError,
  recordAudit,
} from "@/lib/rank-admin";

export const runtime = "nodejs";

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const userId = await parseId(params);
  if (!userId) return jsonError("Invalid player id.", 400);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const rankId = Number(body.rankId);
  if (!Number.isInteger(rankId) || rankId <= 0) {
    return jsonError("Choose a rank to assign.", 422);
  }

  let secondaryRankId: number | null = null;
  if (body.secondaryRankId !== undefined && body.secondaryRankId !== null && body.secondaryRankId !== "") {
    const parsed = Number(body.secondaryRankId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return jsonError("Choose a valid secondary rank.", 422);
    }
    secondaryRankId = parsed;
  }

  try {
    const before = await getPlayerWithPermissions(userId);
    if (!before) return jsonError("Player not found.", 404);
    const player = await assignPlayerRank(userId, rankId, secondaryRankId);
    await recordAudit(
      auth.user,
      "player.rank",
      `Assigned ${player.rank.name}${
        player.secondaryRank ? ` (+ ${player.secondaryRank.name})` : ""
      }; previously ${before.rank.name}${before.secondaryRank ? ` (+ ${before.secondaryRank.name})` : ""}.`,
      { id: player.id, username: player.username },
    );
    return NextResponse.json(
      { player },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RankAdminError) return jsonError(error.message, error.status);
    console.error("Failed to assign rank:", error);
    return jsonError("Could not assign the rank.", 500);
  }
}
