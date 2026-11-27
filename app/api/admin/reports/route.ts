import { NextResponse } from "next/server";
import { jsonError, requireReportManager } from "@/lib/api";
import { listManagementReports } from "@/lib/reports";
import { isReportKind, isReportStatus } from "@/lib/report-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireReportManager();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  const sort = url.searchParams.get("sort");

  if (kind && kind !== "all" && !isReportKind(kind)) return jsonError("Invalid report type.", 422);
  if (status && status !== "all" && !isReportStatus(status)) {
    return jsonError("Invalid report status.", 422);
  }
  if (sort && sort !== "newest" && sort !== "oldest") return jsonError("Invalid sort order.", 422);

  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0) return jsonError("Invalid page offset.", 422);

  const page = await listManagementReports({
    kind: kind && kind !== "all" ? (kind as "player" | "bug") : undefined,
    status: status && status !== "all" ? (status as "pending" | "reviewing" | "resolved" | "rejected") : undefined,
    search: url.searchParams.get("search") ?? "",
    sort: sort === "oldest" ? "oldest" : "newest",
    offset,
  });

  return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
}
