import { jsonError, requireReportManager } from "@/lib/api";
import { getReportFile, parseReportId } from "@/lib/reports";
import { readReportFile, ReportStorageError } from "@/lib/report-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asciiName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "proof";
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end >= size || start > end) return null;
  return { start, end };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  const auth = await requireReportManager();
  if (auth.response) return auth.response;

  const params = await context.params;
  const reportId = parseReportId(params.id);
  const fileId = parseReportId(params.fileId);
  if (reportId === null || fileId === null) return jsonError("Invalid proof file.", 422);

  const file = await getReportFile(reportId, fileId);
  if (!file) return jsonError("Proof file not found.", 404);

  let buffer: Buffer;
  try {
    buffer = await readReportFile(file);
  } catch (error) {
    if (error instanceof ReportStorageError) return jsonError(error.message, error.status);
    console.error("Failed to read report proof:", error);
    return jsonError("The proof file could not be read.", 500);
  }

  const range = parseRange(req.headers.get("range"), buffer.length);
  const body = range ? buffer.subarray(range.start, range.end + 1) : buffer;
  const headers = new Headers({
    "Content-Type": file.mime,
    "Content-Length": String(body.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${asciiName(file.name)}"`,
    "Content-Security-Policy": "sandbox",
  });

  if (range) {
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${buffer.length}`);
    return new Response(new Uint8Array(body), { status: 206, headers });
  }

  headers.set("Accept-Ranges", "bytes");
  return new Response(new Uint8Array(body), { status: 200, headers });
}
