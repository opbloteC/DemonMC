import { NextResponse } from "next/server";
import {
  jsonError,
  mutationGuard,
  readJson,
  requireAnyPermission,
  requirePermission,
} from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import {
  createRule,
  listRulesState,
  normalizeRuleColor,
  RuleAdminError,
} from "@/lib/rules";
import { isRuleIcon } from "@/lib/rule-types";
import { text } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = ["rules.view", "rules.edit", "rules.publish", "rules.delete"] as const;

export async function GET() {
  const auth = await requireAnyPermission(VIEW_PERMISSIONS);
  if (auth.response) return auth.response;

  return NextResponse.json(await listRulesState(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const auth = await requirePermission("rules.edit");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const title = text(body.title, 2, 80);
  if (!title) return jsonError("Title must be between 2 and 80 characters.", 422);

  const description = text(body.description, 2, 400);
  if (!description) return jsonError("Description must be between 2 and 400 characters.", 422);

  if (body.icon !== undefined && !isRuleIcon(body.icon)) {
    return jsonError("Choose a valid rule icon.", 422);
  }
  const color =
    body.color === undefined || body.color === "" ? "#f4842d" : normalizeRuleColor(body.color);
  if (!color) return jsonError("Color must be a six-digit HEX value such as #f4842d.", 422);

  if (body.bold !== undefined && typeof body.bold !== "boolean") {
    return jsonError("Bold must be true or false.", 422);
  }

  try {
    const rule = await createRule({
      title,
      description,
      icon: isRuleIcon(body.icon) ? body.icon : "shield",
      color,
      bold: typeof body.bold === "boolean" ? body.bold : true,
    });
    await recordAudit(auth.user, "rules.create", `Created rule “${title}”.`);
    return NextResponse.json(
      { rule, ...(await listRulesState()) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RuleAdminError) return jsonError(error.message, error.status);
    console.error("Failed to create rule:", error);
    return jsonError("Could not create the rule.", 500);
  }
}
