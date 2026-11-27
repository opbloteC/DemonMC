import { NextResponse } from "next/server";
import { jsonError, requireReportManager } from "@/lib/api";
import { getManagementReport, parseReportId } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReportManager();
  if (auth.response) return auth.response;

  const id = parseReportId((await context.params).id);
  if (id === null) return jsonError("Invalid report ID.", 422);

  const report = await getManagementReport(id);
  if (!report) return jsonError("Report not found.", 404);

  return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
}
