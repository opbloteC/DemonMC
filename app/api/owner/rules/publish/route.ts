import { NextResponse } from "next/server";
import { jsonError, mutationGuard, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import { listRulesState, publishRules, RuleAdminError } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requirePermission("rules.publish");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  try {
    const state = await publishRules();
    await recordAudit(
      auth.user,
      "rules.publish",
      `Published ${state.rules.filter((rule) => rule.enabled).length} rule(s) to the public page.`,
    );
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RuleAdminError) return jsonError(error.message, error.status);
    console.error("Failed to publish rules:", error);
    return jsonError("Could not publish the rules.", 500);
  }
}
