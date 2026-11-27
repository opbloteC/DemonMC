import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { clientKey, isRateLimited } from "@/lib/rate-limit";
import { createReport, parseReportSubmission, ReportError } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  if (isRateLimited(clientKey(req, "report-submit"), 10, 15 * 60 * 1000)) {
    return jsonError("Too many reports submitted. Please wait a few minutes.", 429);
  }

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  try {
    const input = parseReportSubmission(body);
    const user = await getSessionUser();
    const report = await createReport(input, user?.id ?? null);
    return NextResponse.json(
      { report },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ReportError) {
      return NextResponse.json(
        { error: error.message, ...(error.fields ? { fieldErrors: error.fields } : {}) },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Failed to submit report:", error);
    return jsonError("Could not submit the report. Please try again.", 500);
  }
}
