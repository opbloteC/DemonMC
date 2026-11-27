import { NextResponse } from "next/server";
import { jsonError, mutationGuard, requireStoreManager } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import { discardStoreChanges, StoreAdminError } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  try {
    const state = await discardStoreChanges();
    await recordAudit(auth.user, "store.discard", "Discarded unpublished store changes.");
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StoreAdminError) return jsonError(error.message, error.status);
    console.error("Failed to discard store changes:", error);
    return jsonError("Could not discard the store changes.", 500);
  }
}
