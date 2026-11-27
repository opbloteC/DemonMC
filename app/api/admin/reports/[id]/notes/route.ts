import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireReportManager } from "@/lib/api";
import { addReportNote, parseReportId, ReportError } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReportManager();
  if (auth.response) return auth.response;
  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = parseReportId((await context.params).id);
  if (id === null) return jsonError("Invalid report ID.", 422);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  try {
    const notes = await addReportNote(auth.user, id, body.body);
    return NextResponse.json({ notes }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ReportError) return jsonError(error.message, error.status);
    console.error("Failed to save report note:", error);
    return jsonError("Could not save the staff note.", 500);
  }
}
