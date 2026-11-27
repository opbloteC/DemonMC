import { NextResponse } from "next/server";
import { jsonError, mutationGuard } from "@/lib/api";
import { clientKey, isRateLimited } from "@/lib/rate-limit";
import {
  cleanupIdleReportFiles,
  MAX_VIDEO_BYTES,
  ReportStorageError,
  storeUploadedReportFile,
} from "@/lib/report-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;

  if (isRateLimited(clientKey(req, "report-upload"), 40, 15 * 60 * 1000)) {
    return jsonError("Too many uploads. Please wait a few minutes and try again.", 429);
  }

  // Uploads are public: reports can be filed without an account.
  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_VIDEO_BYTES + 1024 * 1024) {
    return jsonError("That file is too large. Videos must be 80 MB or smaller.", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("The upload could not be read. Please choose the file again.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a proof file to upload.");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeUploadedReportFile(buffer, file.name, file.type);
    void cleanupIdleReportFiles().catch((error) => {
      console.error("Failed to clean up expired report uploads:", error);
    });
    return NextResponse.json(
      { file: stored },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ReportStorageError) return jsonError(error.message, error.status);
    console.error("Failed to store report proof:", error);
    return jsonError("The proof file could not be uploaded. Please try again.", 500);
  }
}
