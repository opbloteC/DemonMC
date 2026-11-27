import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { listMySubmissions } from "@/lib/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  return NextResponse.json(
    { submissions: await listMySubmissions(auth.user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
