import { NextResponse } from "next/server";
import { jsonError, mutationGuard, requirePermission } from "@/lib/api";
import { deleteLogo, listLogos } from "@/lib/logos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("website.logos.upload");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid logo id.", 400);

  try {
    await deleteLogo(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The logo could not be deleted.";
    const status =
      message === "Logo not found." ? 404 : message.includes("still used") ? 409 : 500;
    return jsonError(message, status);
  }

  return NextResponse.json(
    { ok: true, logos: await listLogos() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
