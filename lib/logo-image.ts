import { createHash } from "crypto";
import sharp from "sharp";
import { readLogoFile } from "./logos";

const MAX_WIDTH = 2048;
const CACHE_LIMIT = 24;

interface OptimizedLogo {
  body: Buffer;
  contentType: string;
  etag: string;
}

const cache = new Map<string, OptimizedLogo>();
const fileCache = new Map<number, { data: Buffer; mime: string }>();
const FILE_CACHE_LIMIT = 4;

async function logoFile(id: number) {
  const cached = fileCache.get(id);
  if (cached) return cached;
  const file = await readLogoFile(id);
  if (file) {
    if (fileCache.size >= FILE_CACHE_LIMIT) {
      const oldest = fileCache.keys().next().value;
      if (oldest) fileCache.delete(oldest);
    }
    fileCache.set(id, file);
  }
  return file;
}

function remember(key: string, value: OptimizedLogo): OptimizedLogo {
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return value;
}

export function normalizedLogoWidth(value: string | null): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.round(parsed), MAX_WIDTH);
}

export type LogoFormat = "png" | "webp";

export async function optimizedLogoImage(
  id: number,
  width: number,
  format: LogoFormat = "png",
): Promise<OptimizedLogo | null> {
  const key = `${id}:${width}:${format}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const file = await logoFile(id);
  if (!file) return null;

  const etag = `"logo-${createHash("sha1")
    .update(`${id}:${width}:${format}:${file.data.length}:${file.mime}`)
    .digest("base64url")}"`;

  if (!width || file.mime === "image/svg+xml" || file.mime === "image/gif") {
    return remember(key, { body: file.data, contentType: file.mime, etag });
  }

  try {
    let pipeline = sharp(file.data, { failOn: "none" }).resize({
      width,
      withoutEnlargement: true,
    });

    let contentType = file.mime;
    if (format === "webp") {
      pipeline = pipeline.webp({ quality: 90, effort: 4 });
      contentType = "image/webp";
    } else if (file.mime === "image/png") {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
      contentType = "image/png";
    } else if (file.mime === "image/jpeg") {
      pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
      contentType = "image/jpeg";
    } else if (file.mime === "image/webp") {
      pipeline = pipeline.webp({ quality: 85, effort: 4 });
      contentType = "image/webp";
    } else {
      return remember(key, { body: file.data, contentType: file.mime, etag });
    }

    const body = await pipeline.toBuffer();
    return remember(key, { body, contentType, etag });
  } catch {
    return remember(key, { body: file.data, contentType: file.mime, etag });
  }
}
