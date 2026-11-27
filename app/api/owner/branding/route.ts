import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import {
  BrandingError,
  discardBrandingDraft,
  getBrandingState,
  normalizeBrandingInput,
  publishBranding,
  resetBranding,
  saveBrandingDraft,
} from "@/lib/branding";
import { recordAudit } from "@/lib/rank-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  const state = await getBrandingState();
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
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
      const published = await resetBranding();
      await recordAudit(auth.user, "branding.reset", "Restored the global branding defaults.");
      revalidatePath("/", "layout");
      return NextResponse.json(
        { published, draft: published, hasDraft: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (body.restore !== undefined) return jsonError("Invalid restore value.", 422);

    if (body.action === "discard") {
      const state = await getBrandingState();
      await discardBrandingDraft();
      return NextResponse.json(
        { published: state.published, draft: state.published, hasDraft: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const input = normalizeBrandingInput(body);

    if (body.action === "save") {
      const draft = await saveBrandingDraft(input);
      const state = await getBrandingState();
      await recordAudit(auth.user, "branding.draft", "Saved a global branding draft.");
      return NextResponse.json(
        { published: state.published, draft, hasDraft: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (body.action !== undefined && body.action !== "publish") {
      return jsonError("Unknown branding action.", 422);
    }

    const published = await publishBranding(input);
    await recordAudit(
      auth.user,
      "branding.publish",
      `Published global branding for “${published.name}”.`,
    );
    revalidatePath("/", "layout");
    return NextResponse.json(
      { published, draft: published, hasDraft: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BrandingError) return jsonError(error.message, error.status);
    console.error("Failed to update global branding:", error);
    return jsonError("Could not save the global branding.", 500);
  }
}
