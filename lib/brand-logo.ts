import { NextResponse } from "next/server";
import { normalizedLogoWidth, optimizedLogoImage } from "./logo-image";
import { getSlotLogo, type LogoSlot } from "./logos";

const REDIRECT_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function fallback(req: Request): NextResponse {
  return NextResponse.redirect(new URL("/images/dmc-logo.png", req.url), {
    status: 307,
    headers: REDIRECT_HEADERS,
  });
}

export async function brandLogoResponse(req: Request, slot: LogoSlot): Promise<NextResponse> {
  let logo;
  try {
    logo = await getSlotLogo(slot);
  } catch (error) {
    console.error(`Failed to load the ${slot} logo:`, error);
    return fallback(req);
  }

  if (!logo) return fallback(req);
  if (logo.storage === "vercel" && logo.url) {
    return NextResponse.redirect(logo.url, { status: 307, headers: REDIRECT_HEADERS });
  }

  const params = new URL(req.url).searchParams;
  const width = normalizedLogoWidth(params.get("w"));
  const format = params.get("fmt") === "webp" ? "webp" : "png";
  const image = await optimizedLogoImage(logo.id, width, format);
  if (!image) return fallback(req);

  const headers: Record<string, string> = {
    "Content-Type": image.contentType,
    // Revalidate cheaply with the ETag, but let repeat views use the cached copy instantly.
    "Cache-Control": "public, max-age=0, stale-while-revalidate=600",
    ETag: image.etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (image.contentType === "image/svg+xml") {
    headers["Content-Security-Policy"] =
      "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  }

  if (req.headers.get("if-none-match") === image.etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(new Uint8Array(image.body), { headers });
}
