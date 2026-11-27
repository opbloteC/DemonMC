import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireUser } from "@/lib/api";
import {
  ApplicationError,
  isUniqueSubmissionError,
  submitApplication,
} from "@/lib/applications";
import { isApplicationCategory } from "@/lib/application-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const guard = mutationGuard(req);
  if (guard) return guard;
  const body = await readJson(req);
  if (!body || !isApplicationCategory(body.category)) return jsonError("Choose a valid application category.", 422);
  const version = Number(body.version);
  if (!Number.isInteger(version) || version < 1) return jsonError("Invalid application form version.", 422);

  try {
    const submission = await submitApplication(auth.user, body.category, body.answers, version);
    return NextResponse.json({ submission }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { error: error.message, ...(error.fields ? { fieldErrors: error.fields } : {}) },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (isUniqueSubmissionError(error)) return jsonError("You already have a pending application in this category.", 409);
    console.error("Failed to submit application:", error);
    return jsonError("Could not submit your application. Please try again.", 500);
  }
}
