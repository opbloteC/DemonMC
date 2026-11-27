import { brandLogoResponse } from "@/lib/brand-logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return brandLogoResponse(req, "navbar");
}
