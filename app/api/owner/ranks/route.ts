import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import {
  createRank,
  isBadgeStyleValue,
  listRankRecords,
  normalizeHexColor,
  RankAdminError,
  recordAudit,
} from "@/lib/rank-admin";
import { text } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  return NextResponse.json(
    { ranks: await listRankRecords() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const name = text(body.name, 2, 24);
  if (!name) return jsonError("Rank name must be between 2 and 24 characters.", 422);

  const color = body.color === undefined ? "#808080" : normalizeHexColor(body.color);
  if (!color) return jsonError("Choose a valid hex colour such as #FF5500.", 422);

  const textColor =
    body.textColor === undefined ? "#ffffff" : normalizeHexColor(body.textColor);
  if (!textColor) return jsonError("Choose a valid text colour such as #ffffff.", 422);

  const bold = body.bold === undefined ? true : body.bold === true;
  const badgeStyle = body.badgeStyle === undefined ? "solid" : body.badgeStyle;
  if (!isBadgeStyleValue(badgeStyle)) return jsonError("Choose a valid badge style.", 422);

  try {
    const rank = await createRank({ name, color, textColor, bold, badgeStyle });
    await recordAudit(auth.user, "rank.create", `Created rank “${rank.name}” (${rank.key}).`);
    return NextResponse.json(
      { rank, ranks: await listRankRecords() },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RankAdminError) return jsonError(error.message, error.status);
    console.error("Failed to create rank:", error);
    return jsonError("Could not create the rank.", 500);
  }
}
