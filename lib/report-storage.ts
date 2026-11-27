import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "./db";
import type { PendingReportFile, ReportMediaKind } from "./report-types";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_FILES_PER_REPORT = 3;
export const MAX_REPORT_IDLE_MS = 24 * 60 * 60 * 1000;

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export class ReportStorageError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "ReportStorageError";
    this.status = status;
  }
}

function localDir(): string {
  return path.join(process.cwd(), "data", "report-uploads");
}

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

function sniffMedia(buffer: Buffer): ReportMediaKind | null {
  if (buffer.length >= 8) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "image";
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image";
    if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return "image";
    if (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image";
    }
    if (buffer.subarray(4, 8).toString("ascii") === "ftyp") return "video";
    if (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    ) {
      return "video";
    }
  }
  return null;
}

export function validateReportFile(
  buffer: Buffer,
  declaredMime: string,
): { mime: string; mediaKind: ReportMediaKind; extension: string } {
  const mime = declaredMime.split(";")[0].trim().toLowerCase();
  const imageExtension = IMAGE_TYPES[mime];
  const videoExtension = VIDEO_TYPES[mime];
  if (!imageExtension && !videoExtension) {
    throw new ReportStorageError(
      "Proof must be a PNG, JPEG, WEBP or GIF image, or an MP4, WEBM or MOV video.",
    );
  }

  if (buffer.length === 0) throw new ReportStorageError("The selected proof file is empty.");
  const mediaKind: ReportMediaKind = imageExtension ? "image" : "video";
  const limit = mediaKind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (buffer.length > limit) {
    throw new ReportStorageError(
      mediaKind === "image"
        ? "Each image must be 8 MB or smaller."
        : "Each video must be 80 MB or smaller.",
    );
  }

  if (sniffMedia(buffer) !== mediaKind) {
    throw new ReportStorageError("That file does not look like a valid image or video.");
  }

  return {
    mime,
    mediaKind,
    extension: imageExtension ?? (videoExtension as string),
  };
}

export interface StoredReportFile {
  storage: "blob" | "local";
  storageKey: string;
}

async function uploadToBlob(
  buffer: Buffer,
  mime: string,
  extension: string,
): Promise<StoredReportFile> {
  const token = blobToken();
  if (!token) throw new ReportStorageError("File storage is not configured.", 500);
  const pathname = `demonmc/reports/${Date.now()}-${randomBytes(16).toString("hex")}.${extension}`;

  const res = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "x-content-type": mime,
      "x-add-random-suffix": "0",
      "x-vercel-blob-access": "private",
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    throw new ReportStorageError("The proof file could not be stored. Please try again.", 500);
  }

  const data = (await res.json().catch(() => null)) as { url?: unknown } | null;
  if (!data || typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw new ReportStorageError("File storage returned an invalid address.", 500);
  }
  return { storage: "blob", storageKey: data.url };
}

async function saveToLocalDisk(buffer: Buffer, extension: string): Promise<StoredReportFile> {
  const directory = localDir();
  await mkdir(directory, { recursive: true });
  const name = `${Date.now()}-${randomBytes(16).toString("hex")}.${extension}`;
  await writeFile(path.join(directory, name), buffer);
  return { storage: "local", storageKey: name };
}

export async function saveReportFile(
  buffer: Buffer,
  mime: string,
  extension: string,
): Promise<StoredReportFile> {
  if (blobToken()) return uploadToBlob(buffer, mime, extension);
  return saveToLocalDisk(buffer, extension);
}

export async function readReportFile(file: {
  storage: string;
  storageKey: string;
}): Promise<Buffer> {
  if (file.storage === "blob") {
    const token = blobToken();
    const res = await fetch(file.storageKey, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (!res.ok) throw new ReportStorageError("The proof file could not be read.", 500);
    return Buffer.from(await res.arrayBuffer());
  }

  if (file.storage !== "local") {
    throw new ReportStorageError("The proof file could not be read.", 500);
  }
  try {
    return await readFile(path.join(localDir(), path.basename(file.storageKey)));
  } catch {
    throw new ReportStorageError("The proof file is no longer available.", 404);
  }
}

export async function deleteStoredReportFile(file: {
  storage: string;
  storageKey: string;
}): Promise<void> {
  try {
    if (file.storage === "blob") {
      const token = blobToken();
      if (!token) return;
      await fetch("https://blob.vercel-storage.com/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-api-version": "7",
        },
        body: JSON.stringify({ urls: [file.storageKey] }),
      });
      return;
    }
    if (file.storage === "local") {
      await unlink(path.join(localDir(), path.basename(file.storageKey)));
    }
  } catch {
    // Cleanup is best-effort; an orphaned file is never linked to a report.
  }
}

export async function storeUploadedReportFile(
  buffer: Buffer,
  originalName: string,
  declaredMime: string,
): Promise<PendingReportFile> {
  const validated = validateReportFile(buffer, declaredMime);
  const stored = await saveReportFile(buffer, validated.mime, validated.extension);
  const token = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const name = originalName.trim().slice(0, 160) || `proof.${validated.extension}`;

  try {
    await query(
      `INSERT INTO report_files (
         upload_token, report_id, original_name, mime, size_bytes, media_kind,
         storage, storage_key, created_at
       )
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)`,
      [
        token,
        name,
        validated.mime,
        buffer.length,
        validated.mediaKind,
        stored.storage,
        stored.storageKey,
        now,
      ],
    );
  } catch (error) {
    await deleteStoredReportFile(stored);
    throw error;
  }

  return {
    token,
    name,
    mime: validated.mime,
    sizeBytes: buffer.length,
    mediaKind: validated.mediaKind,
  };
}

export function isReportUploadToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function cleanupIdleReportFiles(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_REPORT_IDLE_MS).toISOString();
  const { rows } = await query<{ id: number; storage: string; storage_key: string }>(
    "SELECT id, storage, storage_key FROM report_files WHERE report_id IS NULL AND created_at < $1 LIMIT 50",
    [cutoff],
  );
  for (const row of rows) {
    await query("DELETE FROM report_files WHERE id = $1 AND report_id IS NULL", [row.id]);
    await deleteStoredReportFile({ storage: row.storage, storageKey: row.storage_key });
  }
}
