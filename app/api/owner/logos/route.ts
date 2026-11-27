import { NextResponse } from "next/server";
import {
  jsonError,
  mutationGuard,
  readJson,
  requireAnyPermission,
  requirePermission,
} from "@/lib/api";
import { getBranding } from "@/lib/branding";
import { listLogos, parseLogoSlot, setSlotLogo, storeLogo } from "@/lib/logos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function sniffMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  const head = buffer.subarray(0, 2048).toString("utf8").trimStart();
  if (/^(<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(head)) {
    const all = buffer.toString("utf8").toLowerCase();
    if (!all.includes("<script") && !/\son[a-z]+\s*=/.test(all) && !all.includes("javascript:")) {
      return "image/svg+xml";
    }
  }

  return null;
}

export async function GET() {
  const auth = await requireAnyPermission(["website.logos.upload", "website.access"]);
  if (auth.response) return auth.response;

  return NextResponse.json(
    { logos: await listLogos() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const auth = await requirePermission("website.logos.upload");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Upload a logo file using the form.", 400);
  }

  const slot = parseLogoSlot(form.get("slot"));
  if (!slot) {
    return jsonError("Choose the navbar or homepage hero position for this logo.", 422);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a logo file to upload.", 422);
  if (file.size === 0) return jsonError("The selected file is empty.", 422);
  if (file.size > MAX_BYTES) return jsonError("Logos must be 2 MB or smaller.", 422);

  const buffer = Buffer.from(await file.arrayBuffer());
  const claimed = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const sniffed = sniffMime(buffer);

  if (!sniffed || !ALLOWED.has(sniffed)) {
    return jsonError("Upload a PNG, JPG, JPEG, SVG or WebP image.", 422);
  }
  if (claimed && ALLOWED.has(claimed) && claimed !== sniffed) {
    return jsonError("The file contents do not match its image type.", 422);
  }

  const rawLabel = form.get("label");
  const branding = await getBranding();
  const label =
    (typeof rawLabel === "string" ? rawLabel.trim() : "") ||
    file.name.replace(/\.[^.]+$/, "").trim() ||
    `${branding.name} logo`;

  if (label.length > 60) return jsonError("Logo name must be 60 characters or fewer.", 422);

  try {
    const logo = await storeLogo(buffer, sniffed, label);
    await setSlotLogo(slot, logo.id);
    return NextResponse.json(
      { logo, logos: await listLogos() },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Logo upload failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "The logo could not be saved.",
      500,
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requirePermission("website.logos.upload");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const slot = parseLogoSlot(body.slot);
  if (!slot) {
    return jsonError("Choose whether to update the navbar or homepage hero logo.", 422);
  }

  if (body.activeId === null) {
    await setSlotLogo(slot, null);
    return NextResponse.json(
      { ok: true, logos: await listLogos() },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const id = Number(body.activeId);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Choose a logo to activate.", 422);

  try {
    await setSlotLogo(slot, id);
  } catch {
    return jsonError("That logo no longer exists.", 404);
  }

  return NextResponse.json(
    { ok: true, logos: await listLogos() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
