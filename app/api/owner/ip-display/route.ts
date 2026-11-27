import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwner } from "@/lib/api";
import {
  effectiveIpDisplayText,
  getIpDisplaySettings,
  saveIpDisplaySettings,
} from "@/lib/ip-display";
import { MAX_IP_DISPLAY_TEXT } from "@/lib/ip-display-format";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwner();
  if (auth.response) return auth.response;

  const [settings, display] = await Promise.all([getSettings(), getIpDisplaySettings()]);

  return NextResponse.json(
    {
      displayText: effectiveIpDisplayText(settings.ip, display.displayText),
      showGlobe: display.showGlobe,
      copyValue: settings.ip,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const auth = await requireOwner();
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const displayText = typeof body.displayText === "string" ? body.displayText.trim() : "";
  if (!displayText) return jsonError("Enter the IP display text.", 422);
  if (displayText.length > MAX_IP_DISPLAY_TEXT) {
    return jsonError(`IP display text must be ${MAX_IP_DISPLAY_TEXT} characters or fewer.`, 422);
  }
  if (typeof body.showGlobe !== "boolean") {
    return jsonError("Choose whether to show the globe icon.", 422);
  }

  const settings = await getSettings();
  await saveIpDisplaySettings(displayText, body.showGlobe);

  return NextResponse.json(
    {
      displayText,
      showGlobe: body.showGlobe,
      copyValue: settings.ip,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
