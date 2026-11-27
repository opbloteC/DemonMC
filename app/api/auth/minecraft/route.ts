import { jsonError, requireUser } from "@/lib/api";
import { getBranding } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const branding = await getBranding();

  return jsonError(
    `Minecraft usernames are locked and cannot be changed. Contact ${branding.name} staff if you need help.`,
    403,
  );
}
