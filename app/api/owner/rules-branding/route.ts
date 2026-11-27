import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import {
  defaultRulesBrandName,
  getRulesBrandName,
  resetRulesBrandName,
  RulesBrandingError,
  saveRulesBrandName,
} from "@/lib/rules-branding";
import { MAX_RULES_BRAND_LENGTH } from "@/lib/rules-branding-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function payload(name: string) {
  return {
    name,
    defaultName: await defaultRulesBrandName(),
    maxLength: MAX_RULES_BRAND_LENGTH,
  };
}

export async function GET() {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  return NextResponse.json(await payload(await getRulesBrandName()), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(req: Request) {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  try {
    if (body.restore === true) {
      const name = await resetRulesBrandName();
      await recordAudit(auth.user, "rules.branding.reset", "Restored the default rules page name.");
      revalidatePath("/rules");
      return NextResponse.json(await payload(name), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (body.restore !== undefined) {
      return jsonError("Invalid restore value.", 422);
    }

    const name = await saveRulesBrandName(body.name);
    await recordAudit(
      auth.user,
      "rules.branding.save",
      `Changed the public rules page name to “${name}”.`,
    );
    revalidatePath("/rules");
    return NextResponse.json(await payload(name), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RulesBrandingError) return jsonError(error.message, error.status);
    console.error("Failed to update rules branding:", error);
    return jsonError("Could not save the rules page name.", 500);
  }
}
