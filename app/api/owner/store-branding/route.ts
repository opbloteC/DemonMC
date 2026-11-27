import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwnerAccount } from "@/lib/api";
import { recordAudit } from "@/lib/rank-admin";
import {
  defaultStoreBrandName,
  getStoreBrandName,
  resetStoreBrandName,
  saveStoreBrandName,
  StoreBrandingError,
} from "@/lib/store-branding";
import { MAX_STORE_BRAND_LENGTH } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function payload(name: string) {
  return {
    name,
    defaultName: await defaultStoreBrandName(),
    maxLength: MAX_STORE_BRAND_LENGTH,
  };
}

export async function GET() {
  const auth = await requireOwnerAccount();
  if (auth.response) return auth.response;

  return NextResponse.json(await payload(await getStoreBrandName()), {
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
      const name = await resetStoreBrandName();
      await recordAudit(auth.user, "store.branding.reset", "Restored the default store name.");
      revalidatePath("/store");
      return NextResponse.json(await payload(name), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (body.restore !== undefined) {
      return jsonError("Invalid restore value.", 422);
    }

    const name = await saveStoreBrandName(body.name);
    await recordAudit(auth.user, "store.branding.save", `Changed the public store name to “${name}”.`);
    revalidatePath("/store");
    return NextResponse.json(await payload(name), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StoreBrandingError) return jsonError(error.message, error.status);
    console.error("Failed to update store branding:", error);
    return jsonError("Could not save the store name.", 500);
  }
}
