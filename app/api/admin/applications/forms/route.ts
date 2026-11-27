import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireApplicationManager } from "@/lib/api";
import { ApplicationError, listApplicationManagementState, saveApplicationFormBody } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApplicationManager();
  if (auth.response) return auth.response;
  return NextResponse.json(await listApplicationManagementState(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const auth = await requireApplicationManager();
  if (auth.response) return auth.response;
  const guard = mutationGuard(req);
  if (guard) return guard;
  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");
  try {
    const form = await saveApplicationFormBody(body);
    return NextResponse.json({ form }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { error: error.message, ...(error.fields ? { fieldErrors: error.fields } : {}) },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Failed to save application form:", error);
    return jsonError("Could not save the application form.", 500);
  }
}
