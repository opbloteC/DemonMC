import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireStoreManager } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import { listStoreState, reorderStoreRanks, StoreAdminError } from "@/lib/store";
import { isStoreCategory } from "@/lib/store-types";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  if (!isStoreCategory(body.category)) {
    return jsonError("Choose the store category to reorder.", 422);
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonError("Send the store order as a list of store card ids.", 422);
  }
  const category = body.category;
  const ids: number[] = [];
  for (const raw of body.ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonError("Invalid store card id in the order.", 422);
    }
    ids.push(id);
  }

  try {
    const ranks = await reorderStoreRanks(category, ids);
    const names = ids
      .map((id) => ranks.find((rank) => rank.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    await recordAudit(
      auth.user,
      "store.reorder",
      `Saved ${category} display order: ${names.join(" → ")}.`,
    );
    return NextResponse.json(await listStoreState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StoreAdminError) return jsonError(error.message, error.status);
    console.error("Failed to reorder store cards:", error);
    return jsonError("Could not save the store order.", 500);
  }
}
