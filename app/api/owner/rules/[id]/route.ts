import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import {
  deleteRule,
  getRule,
  listRulesState,
  normalizeRuleColor,
  RuleAdminError,
  updateRule,
} from "@/lib/rules";
import { isRuleIcon, type RuleIcon } from "@/lib/rule-types";
import { text } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("rules.edit");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = parseId((await params).id);
  if (!id) return jsonError("Invalid rule id.", 422);
  if (!(await getRule(id))) return jsonError("Rule not found.", 404);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const patch: {
    title?: string;
    description?: string;
    icon?: RuleIcon;
    color?: string;
    bold?: boolean;
    enabled?: boolean;
  } = {};

  if (body.title !== undefined) {
    const title = text(body.title, 2, 80);
    if (!title) return jsonError("Title must be between 2 and 80 characters.", 422);
    patch.title = title;
  }
  if (body.description !== undefined) {
    const description = text(body.description, 2, 400);
    if (!description) return jsonError("Description must be between 2 and 400 characters.", 422);
    patch.description = description;
  }
  if (body.icon !== undefined) {
    if (!isRuleIcon(body.icon)) return jsonError("Choose a valid rule icon.", 422);
    patch.icon = body.icon;
  }
  if (body.color !== undefined) {
    const color = normalizeRuleColor(body.color);
    if (!color) return jsonError("Color must be a six-digit HEX value such as #f4842d.", 422);
    patch.color = color;
  }
  if (body.bold !== undefined) {
    if (typeof body.bold !== "boolean") return jsonError("Bold must be true or false.", 422);
    patch.bold = body.bold;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return jsonError("Enabled must be true or false.", 422);
    patch.enabled = body.enabled;
  }

  try {
    const rule = await updateRule(id, patch);
    await recordAudit(
      auth.user,
      "rules.update",
      `Updated rule “${rule.title}” (${rule.enabled ? "enabled" : "disabled"}).`,
    );
    return NextResponse.json(
      { rule, ...(await listRulesState()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RuleAdminError) return jsonError(error.message, error.status);
    console.error("Failed to update rule:", error);
    return jsonError("Could not update the rule.", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("rules.delete");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = parseId((await params).id);
  if (!id) return jsonError("Invalid rule id.", 422);
  const existing = await getRule(id);
  if (!existing) return jsonError("Rule not found.", 404);

  try {
    await deleteRule(id);
    await recordAudit(auth.user, "rules.delete", `Deleted rule “${existing.title}”.`);
    return NextResponse.json(await listRulesState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RuleAdminError) return jsonError(error.message, error.status);
    console.error("Failed to delete rule:", error);
    return jsonError("Could not delete the rule.", 500);
  }
}
