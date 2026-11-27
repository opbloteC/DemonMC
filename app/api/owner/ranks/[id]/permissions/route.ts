import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import {
  getRankRecord,
  RankAdminError,
  recordAudit,
  setRankPermissions,
} from "@/lib/rank-admin";

export const runtime = "nodejs";

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid rank id.", 400);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  if (!Array.isArray(body.allowed)) {
    return jsonError("Send the allowed permission keys as a list.", 422);
  }
  const allowed: string[] = [];
  for (const raw of body.allowed) {
    if (typeof raw !== "string") return jsonError("Invalid permission key.", 422);
    allowed.push(raw);
  }

  try {
    const before = await getRankRecord(id);
    if (!before) return jsonError("Rank not found.", 404);
    const added = allowed.filter((key) => !before.permissions[key]);
    const removed = Object.keys(before.permissions).filter((key) => !allowed.includes(key));
    const rank = await setRankPermissions(id, allowed);
    const changes = [
      added.length ? `granted ${added.length}` : "",
      removed.length ? `revoked ${removed.length}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    await recordAudit(
      auth.user,
      "rank.permissions",
      `Updated permissions for “${rank.name}”${changes ? ` (${changes})` : ""}.`,
    );
    return NextResponse.json(
      { rank },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RankAdminError) return jsonError(error.message, error.status);
    console.error("Failed to update rank permissions:", error);
    return jsonError("Could not update the rank permissions.", 500);
  }
}
