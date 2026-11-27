import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import {
  getPlayerWithPermissions,
  recordAudit,
  RankAdminError,
  setPlayerPermission,
} from "@/lib/rank-admin";
import { PERMISSION_MAP } from "@/lib/permission-registry";

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

  const permissionKey = typeof body.permissionKey === "string" ? body.permissionKey : "";
  const definition = PERMISSION_MAP.get(permissionKey);
  if (!definition) return jsonError("Unknown permission key.", 422);

  const effect = body.effect;
  if (effect !== "allow" && effect !== "deny" && effect !== "inherit") {
    return jsonError("Choose allow, deny or inherit.", 422);
  }

  try {
    const before = await getPlayerWithPermissions(userId);
    if (!before) return jsonError("Player not found.", 404);
    const player = await setPlayerPermission(userId, permissionKey, effect);
    const previous =
      before.overrides.find((override) => override.permissionKey === permissionKey)?.effect ??
      "inherit";
    await recordAudit(
      auth.user,
      "player.permission",
      `${definition.label}: ${previous} → ${effect}.`,
      { id: player.id, username: player.username },
    );
    return NextResponse.json(
      { player },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RankAdminError) return jsonError(error.message, error.status);
    console.error("Failed to update player permission:", error);
    return jsonError("Could not update the player permission.", 500);
  }
}
