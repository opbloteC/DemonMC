import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireApplicationManager } from "@/lib/api";
import { addApplicationNote, ApplicationError, parseSubmissionId } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApplicationManager();
  if (auth.response) return auth.response;
  const guard = mutationGuard(req);
  if (guard) return guard;
  const id = parseSubmissionId((await context.params).id);
  if (id === null) return jsonError("Invalid application ID.", 422);
  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");
  try {
    const notes = await addApplicationNote(auth.user, id, body.body);
    return NextResponse.json({ notes }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApplicationError) return jsonError(error.message, error.status);
    console.error("Failed to save application note:", error);
    return jsonError("Could not save the review note.", 500);
  }
}
