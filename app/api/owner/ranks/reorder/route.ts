import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import {
  RankAdminError,
  recordAudit,
  reorderRanks,
} from "@/lib/rank-admin";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonError("Send the rank order as a list of rank ids.", 422);
  }
  const ids: number[] = [];
  for (const raw of body.ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid rank id in the order.", 422);
    ids.push(id);
  }

  try {
    const ranks = await reorderRanks(ids);
    const names = ids
      .map((id) => ranks.find((rank) => rank.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    await recordAudit(
      auth.user,
      "rank.reorder",
      `Saved rank display order: ${names.join(" → ")}.`,
    );
    return NextResponse.json(
      { ranks },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RankAdminError) return jsonError(error.message, error.status);
    console.error("Failed to reorder ranks:", error);
    return jsonError("Could not save the rank order.", 500);
  }
}
