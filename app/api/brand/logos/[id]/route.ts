import { NextResponse } from "next/server";
import { getLogo, readLogoFile } from "@/lib/logos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  }

  const logo = await getLogo(id);
  if (!logo) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  if (logo.storage === "vercel" && logo.url) {
    return NextResponse.redirect(logo.url, { status: 307, headers: NO_STORE });
  }

  const file = await readLogoFile(id);
  if (!file) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      ...NO_STORE,
      "Content-Type": file.mime,
      "X-Content-Type-Options": "nosniff",
      ...(file.mime === "image/svg+xml"
        ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" }
        : {}),
    },
  });
}
