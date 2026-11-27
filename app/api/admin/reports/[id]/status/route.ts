import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireReportManager } from "@/lib/api";
import { parseReportId, ReportError, setReportStatus } from "@/lib/reports";

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
    const report = await setReportStatus(auth.user, id, body.status);
    return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ReportError) return jsonError(error.message, error.status);
    console.error("Failed to update report status:", error);
    return jsonError("Could not update the report status.", 500);
  }
}
