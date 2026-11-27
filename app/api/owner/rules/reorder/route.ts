import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import { listRulesState, reorderRules, RuleAdminError } from "@/lib/rules";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const auth = await requirePermission("rules.edit");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonError("Send the rule order as a list of rule ids.", 422);
  }
  const ids: number[] = [];
  for (const raw of body.ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid rule id in the order.", 422);
    ids.push(id);
  }

  try {
    const rules = await reorderRules(ids);
    const names = new Map(rules.map((rule) => [rule.id, rule.title]));
    await recordAudit(
      auth.user,
      "rules.reorder",
      `Saved rule display order: ${ids.map((id) => names.get(id) ?? id).join(" → ")}.`,
    );
    return NextResponse.json(
      { ...(await listRulesState()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RuleAdminError) return jsonError(error.message, error.status);
    console.error("Failed to reorder rules:", error);
    return jsonError("Could not save the rule order.", 500);
  }
}
