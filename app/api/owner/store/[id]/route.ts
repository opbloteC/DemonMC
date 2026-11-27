import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireStoreManager } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import {
  deleteStoreRank,
  getStoreRank,
  listStoreState,
  StoreAdminError,
  syncStoreRankColor,
  updateStoreRank,
} from "@/lib/store";
import { parseStoreInput } from "@/lib/store-validation";

export const runtime = "nodejs";

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid store card id.", 400);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  try {
    if (body.syncColor === true) {
      const card = await syncStoreRankColor(id);
      await recordAudit(
        auth.user,
        "store.sync-color",
        `Synced store card “${card.name}” colour from rank “${card.rank?.name ?? "unknown"}”.`,
      );
      return NextResponse.json(await listStoreState(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (body.syncColor !== undefined) {
      return jsonError("Sync colour must be true.", 422);
    }

    const patch = parseStoreInput(body, false);
    if (Object.keys(patch).length === 0) return jsonError("No changes provided.", 422);

    const existing = await getStoreRank(id);
    if (!existing) return jsonError("Store card not found.", 404);

    const card = await updateStoreRank(id, patch);
    await recordAudit(
      auth.user,
      "store.update",
      `Updated store card “${card.name}” (${Object.keys(patch).join(", ")}).`,
    );
    return NextResponse.json(await listStoreState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StoreAdminError) return jsonError(error.message, error.status);
    console.error("Failed to update store card:", error);
    return jsonError("Could not update the store card.", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid store card id.", 400);

  try {
    const existing = await getStoreRank(id);
    if (!existing) return jsonError("Store card not found.", 404);
    await deleteStoreRank(id);
    await recordAudit(
      auth.user,
      "store.delete",
      `Deleted store card “${existing.name}”. The linked rank was left untouched.`,
    );
    return NextResponse.json(await listStoreState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StoreAdminError) return jsonError(error.message, error.status);
    console.error("Failed to delete store card:", error);
    return jsonError("Could not delete the store card.", 500);
  }
}
