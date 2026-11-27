import { NextResponse } from "next/server";
import { jsonError, mutationGuard, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import { discardRuleChanges, listRulesState, RuleAdminError } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requirePermission("rules.edit");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  try {
    const state = await discardRuleChanges();
    await recordAudit(auth.user, "rules.discard", "Discarded unpublished rule changes.");
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RuleAdminError) return jsonError(error.message, error.status);
    console.error("Failed to discard rule changes:", error);
    return jsonError("Could not discard the rule changes.", 500);
  }
}
