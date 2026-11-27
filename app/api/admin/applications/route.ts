import { NextResponse } from "next/server";
import { jsonError, requireApplicationManager } from "@/lib/api";
import { listApplicationManagementState, listManagementSubmissions } from "@/lib/applications";
import {
  APPLICATION_CATEGORIES,
  APPLICATION_STATUSES,
  isApplicationCategory,
  type ApplicationCategory,
  type ApplicationStatus,
} from "@/lib/application-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireApplicationManager();
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const sort = url.searchParams.get("sort");
  if (category && category !== "all" && !isApplicationCategory(category)) return jsonError("Invalid application category.", 422);
  if (status && status !== "all" && !(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    return jsonError("Invalid application status.", 422);
  }
  if (sort && sort !== "newest" && sort !== "oldest") return jsonError("Invalid sort order.", 422);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0) return jsonError("Invalid page offset.", 422);
  const [state, page] = await Promise.all([
    listApplicationManagementState(),
    listManagementSubmissions({
      category: category && category !== "all" ? category as ApplicationCategory : undefined,
      status: status && status !== "all" ? status as ApplicationStatus : undefined,
      search: url.searchParams.get("search")?.slice(0, 100) ?? "",
      sort: sort === "oldest" ? "oldest" : "newest",
      offset,
    }),
  ]);
  return NextResponse.json(
    { ...state, submissions: page.submissions, nextOffset: page.nextOffset, categories: APPLICATION_CATEGORIES },
    { headers: { "Cache-Control": "no-store" } },
  );
}
