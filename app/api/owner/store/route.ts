import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireStoreManager } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import {
  createStoreRank,
  listStoreState,
  StoreAdminError,
} from "@/lib/store";
import type { StoreRankInput } from "@/lib/store";
import { parseStoreInput } from "@/lib/store-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  return NextResponse.json(await listStoreState(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const auth = await requireStoreManager();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  try {
    const patch = parseStoreInput(body, true);
    const rank = await createStoreRank({
      ...patch,
      category: patch.category ?? "rank",
      rankId: patch.rankId ?? null,
    } as StoreRankInput);
    await recordAudit(
      auth.user,
      "store.create",
      `Created ${rank.category} store card “${rank.name}”${
        rank.rank ? ` linked to rank “${rank.rank.name}”` : ""
      }.`,
    );
    return NextResponse.json(await listStoreState(), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StoreAdminError) return jsonError(error.message, error.status);
    console.error("Failed to create store card:", error);
    return jsonError("Could not create the store card.", 500);
  }
}
