import { NextResponse } from "next/server";
import { jsonError, mutationGuard, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import { listRulesState, resetRulesToDefaults, RuleAdminError } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requirePermission("rules.delete");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  try {
    const state = await resetRulesToDefaults();
    await recordAudit(
      auth.user,
      "rules.reset",
      "Reset the draft rules to the ten original DemonMC defaults.",
    );
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RuleAdminError) return jsonError(error.message, error.status);
    console.error("Failed to reset rules:", error);
    return jsonError("Could not restore the default rules.", 500);
  }
}
