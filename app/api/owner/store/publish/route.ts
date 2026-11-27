import { NextResponse } from "next/server";
import { jsonError, mutationGuard, requireStoreManager } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import { listStoreState, publishStore, StoreAdminError } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  try {
    const state = await publishStore();
    const live = state.ranks.filter((rank) => rank.enabled).length;
    await recordAudit(
      auth.user,
      "store.publish",
      `Published ${live} store card(s) to the public /store page.`,
    );
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StoreAdminError) return jsonError(error.message, error.status);
    console.error("Failed to publish store:", error);
    return jsonError("Could not publish the store.", 500);
  }
}
