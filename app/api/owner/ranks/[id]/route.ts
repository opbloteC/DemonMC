import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import {
  deleteRank,
  isBadgeStyleValue,
  listRankRecords,
  normalizeHexColor,
  RankAdminError,
  recordAudit,
  restoreRank,
  updateRank,
} from "@/lib/rank-admin";
import type { BadgeStyle } from "@/lib/rank-types";
import { text } from "@/lib/validation";

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

  const id = await parseId(params);
  if (!id) return jsonError("Invalid rank id.", 400);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  try {
    if (body.action === "restore") {
      const rank = await restoreRank(id);
      await recordAudit(auth.user, "rank.restore", `Restored rank “${rank.name}”.`);
      return NextResponse.json(
        { rank, ranks: await listRankRecords() },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const patch: {
      name?: string;
      color?: string;
      textColor?: string;
      bold?: boolean;
      badgeStyle?: BadgeStyle;
    } = {};

    if ("name" in body) {
      const name = text(body.name, 2, 24);
      if (!name) return jsonError("Rank name must be between 2 and 24 characters.", 422);
      patch.name = name;
    }
    if ("color" in body) {
      const color = normalizeHexColor(body.color);
      if (!color) return jsonError("Choose a valid hex colour such as #FF5500.", 422);
      patch.color = color;
    }
    if ("textColor" in body) {
      const textColor = normalizeHexColor(body.textColor);
      if (!textColor) return jsonError("Choose a valid text colour such as #ffffff.", 422);
      patch.textColor = textColor;
    }
    if ("bold" in body) {
      if (typeof body.bold !== "boolean") return jsonError("Bold must be true or false.", 422);
      patch.bold = body.bold;
    }
    if ("badgeStyle" in body) {
      if (!isBadgeStyleValue(body.badgeStyle)) return jsonError("Choose a valid badge style.", 422);
      patch.badgeStyle = body.badgeStyle;
    }

    const rank = await updateRank(id, patch);
    await recordAudit(
      auth.user,
      "rank.update",
      `Updated rank “${rank.name}” (${Object.keys(patch).join(", ")}).`,
    );
    return NextResponse.json(
      { rank, ranks: await listRankRecords() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RankAdminError) return jsonError(error.message, error.status);
    console.error("Failed to update rank:", error);
    return jsonError("Could not update the rank.", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid rank id.", 400);

  try {
    const rank = await deleteRank(id);
    await recordAudit(auth.user, "rank.delete", `Deleted rank “${rank.name}”.`);
    return NextResponse.json(
      { rank, ranks: await listRankRecords() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RankAdminError) return jsonError(error.message, error.status);
    console.error("Failed to delete rank:", error);
    return jsonError("Could not delete the rank.", 500);
  }
}
