import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireStoreManager } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import {
  getStorePromotion,
  listStoreState,
  saveStorePromotion,
  StoreAdminError,
} from "@/lib/store";
import { parsePromotionInput } from "@/lib/store-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  return NextResponse.json(await getStorePromotion(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(req: Request) {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  try {
    const input = parsePromotionInput(body);
    const promotion = await saveStorePromotion(input, auth.user.username);
    await recordAudit(
      auth.user,
      "store.promotion",
      promotion.enabled
        ? `Saved ${promotion.discountPercent}% store promotion “${promotion.title}” (${promotion.theme} theme).`
        : `Saved store promotion settings with the sale disabled (${promotion.theme} theme).`,
    );
    return NextResponse.json(await listStoreState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StoreAdminError) return jsonError(error.message, error.status);
    console.error("Failed to save store promotion:", error);
    return jsonError("Could not save the store promotion.", 500);
  }
}
