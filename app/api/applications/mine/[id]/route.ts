import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { getMySubmission, parseSubmissionId } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const id = parseSubmissionId((await context.params).id);
  if (id === null) return jsonError("Invalid application ID.", 422);
  const submission = await getMySubmission(auth.user.id, id);
  if (!submission) return jsonError("Application not found.", 404);
  return NextResponse.json({ submission }, { headers: { "Cache-Control": "no-store" } });
}
