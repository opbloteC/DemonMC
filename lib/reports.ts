import { query, withTransaction } from "./db";
import {
  displayReportId,
  isReportKind,
  isReportStatus,
  type ReportDetail,
  type ReportFileSummary,
  type ReportKind,
  type ReportListPage,
  type ReportNote,
  type ReportStatus,
  type ReportSummary,
} from "./report-types";
import {
  isReportUploadToken,
  MAX_FILES_PER_REPORT,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "./report-storage";
import type { SessionUser } from "./types";
import { normalizeMinecraftName } from "./validation";

export class ReportError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status = 422, fields?: Record<string, string>) {
    super(message);
    this.name = "ReportError";
    this.status = status;
    this.fields = fields;
  }
}

interface ReportRow {
  id: number;
  kind: string;
  status: string;
  submitter_username: string;
  reported_username: string | null;
  reason: string;
  description: string;
  created_at: string;
  updated_at: string;
  reviewed_by_username: string | null;
  file_count?: string | number;
}

interface ReportFileRow {
  id: number;
  original_name: string;
  mime: string;
  size_bytes: number;
  media_kind: string;
}

interface ReportNoteRow {
  id: number;
  author_username: string;
  body: string;
  created_at: string;
}

function mapSummary(row: ReportRow): ReportSummary {
  return {
    id: row.id,
    displayId: displayReportId(row.id),
    kind: row.kind === "bug" ? "bug" : "player",
    status: isReportStatus(row.status) ? row.status : "pending",
    submitterUsername: row.submitter_username,
    reportedUsername: row.reported_username,
    reason: row.reason,
    description: row.description,
    submittedAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedBy: row.reviewed_by_username,
    fileCount: Number(row.file_count ?? 0),
  };
}

export function parseReportId(value: string | undefined): number | null {
  const id = Number(value ?? "");
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseReportFileId(value: string | undefined): number | null {
  return parseReportId(value);
}

function emptyCounts(): Record<ReportKind, Record<ReportStatus, number>> {
  const make = () => ({ pending: 0, reviewing: 0, resolved: 0, rejected: 0 });
  return { player: make(), bug: make() };
}

export async function listManagementReports(filters: {
  kind?: ReportKind;
  status?: ReportStatus;
  search?: string;
  sort?: "newest" | "oldest";
  offset?: number;
}): Promise<ReportListPage> {
  const limit = 20;
  const offset = Math.max(0, filters.offset ?? 0);
  const search = (filters.search ?? "").trim().slice(0, 100);
  const idMatch = /^(?:rpt-)?(\d{1,9})$/i.exec(search);
  const idNumber = idMatch ? Number(idMatch[1]) : null;
  const direction = filters.sort === "oldest" ? "ASC" : "DESC";

  const [list, countRows] = await Promise.all([
    query<ReportRow>(
      `SELECT r.id, r.kind, r.status, r.submitter_username, r.reported_username,
              r.reason, r.description, r.created_at, r.updated_at, r.reviewed_by_username,
              (SELECT count(*) FROM report_files f WHERE f.report_id = r.id) AS file_count
       FROM reports r
       WHERE ($1::text IS NULL OR r.kind = $1)
         AND ($2::text IS NULL OR r.status = $2)
         AND (
           $3::text = ''
           OR r.submitter_username ILIKE '%' || $3 || '%'
           OR r.reported_username ILIKE '%' || $3 || '%'
           OR ($4::int IS NOT NULL AND r.id = $4)
         )
       ORDER BY r.created_at ${direction}, r.id ${direction}
       LIMIT ${limit + 1} OFFSET $5`,
      [filters.kind ?? null, filters.status ?? null, search, idNumber, offset],
    ),
    query<{ kind: string; status: string; count: string }>(
      "SELECT kind, status, count(*)::text AS count FROM reports GROUP BY kind, status",
    ),
  ]);

  const counts = emptyCounts();
  for (const row of countRows.rows) {
    if (isReportKind(row.kind) && isReportStatus(row.status)) {
      counts[row.kind][row.status] = Number(row.count);
    }
  }

  const rows = list.rows.slice(0, limit);
  return {
    reports: rows.map(mapSummary),
    nextOffset: list.rows.length > limit ? offset + limit : null,
    counts,
  };
}

export async function getManagementReport(id: number): Promise<ReportDetail | null> {
  const { rows } = await query<ReportRow>(
    `SELECT id, kind, status, submitter_username, reported_username, reason, description,
            created_at, updated_at, reviewed_by_username
     FROM reports WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return null;

  const [files, notes] = await Promise.all([
    query<ReportFileRow>(
      `SELECT id, original_name, mime, size_bytes, media_kind
       FROM report_files WHERE report_id = $1 ORDER BY id`,
      [id],
    ),
    query<ReportNoteRow>(
      `SELECT id, author_username, body, created_at
       FROM report_notes WHERE report_id = $1 ORDER BY created_at, id`,
      [id],
    ),
  ]);

  const summary = mapSummary(rows[0]);
  return {
    ...summary,
    fileCount: files.rows.length,
    files: files.rows.map((file): ReportFileSummary => ({
      id: file.id,
      name: file.original_name,
      mime: file.mime,
      sizeBytes: Number(file.size_bytes),
      mediaKind: file.media_kind === "video" ? "video" : "image",
      url: `/api/admin/reports/${id}/files/${file.id}`,
    })),
    notes: notes.rows.map((note): ReportNote => ({
      id: note.id,
      authorUsername: note.author_username,
      body: note.body,
      createdAt: note.created_at,
    })),
  };
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export interface ReportSubmissionInput {
  kind: ReportKind;
  submitterUsername: string;
  reportedUsername: string | null;
  reason: string;
  description: string;
  fileTokens: string[];
}

export function parseReportSubmission(body: Record<string, unknown>): ReportSubmissionInput {
  if (!isReportKind(body.kind)) throw new ReportError("Choose the type of report.");
  const kind = body.kind;

  const submitter = normalizeMinecraftName(body.submitterUsername);
  if (!submitter) {
    throw new ReportError("Enter your Minecraft username.", 422, {
      submitterUsername: "Use 3–16 letters, numbers or underscores.",
    });
  }

  let reportedUsername: string | null = null;
  if (kind === "player") {
    reportedUsername = normalizeMinecraftName(body.reportedUsername);
    if (!reportedUsername) {
      throw new ReportError("Enter the reported player's Minecraft username.", 422, {
        reportedUsername: "Use 3–16 letters, numbers or underscores.",
      });
    }
    if (reportedUsername.toLowerCase() === submitter.toLowerCase()) {
      throw new ReportError("You cannot report your own username.", 422, {
        reportedUsername: "Enter the username of the player you are reporting.",
      });
    }
  }

  const reason = kind === "player" ? cleanText(body.reason, 1000) : "";
  if (kind === "player" && reason.length < 3) {
    throw new ReportError("Describe why you are reporting this player.", 422, {
      reason: "Add a short reason (at least 3 characters).",
    });
  }

  const description = kind === "bug" ? cleanText(body.description, 4000) : "";
  if (kind === "bug" && description.length < 5) {
    throw new ReportError("Describe the bug you encountered.", 422, {
      description: "Add a short description (at least 5 characters).",
    });
  }

  const rawFiles = Array.isArray(body.files) ? body.files : [];
  const tokens = [...new Set(rawFiles.filter(isReportUploadToken))];
  if (tokens.length === 0) {
    throw new ReportError("Attach at least one screenshot or video as proof.", 422, {
      proof: "Proof is required for every report.",
    });
  }
  if (tokens.length > MAX_FILES_PER_REPORT) {
    throw new ReportError(`Attach at most ${MAX_FILES_PER_REPORT} proof files.`, 422, {
      proof: `Attach at most ${MAX_FILES_PER_REPORT} files.`,
    });
  }

  return { kind, submitterUsername: submitter, reportedUsername, reason, description, fileTokens: tokens };
}

export async function createReport(
  input: ReportSubmissionInput,
  userId: number | null,
): Promise<ReportSummary> {
  const now = new Date().toISOString();

  return withTransaction(async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO reports (
         kind, status, submitter_username, reported_username, reason, description,
         user_id, created_at, updated_at
       )
       VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $7)
       RETURNING id`,
      [
        input.kind,
        input.submitterUsername,
        input.reportedUsername,
        input.reason,
        input.description,
        userId,
        now,
      ],
    );
    const reportId = inserted.rows[0].id;

    const claimed = await client.query<{
      id: number;
      mime: string;
      size_bytes: number;
    }>(
      `UPDATE report_files SET report_id = $1
       WHERE report_id IS NULL
         AND upload_token = ANY($2::text[])
         AND (
           (media_kind = 'image' AND size_bytes <= $3)
           OR (media_kind = 'video' AND size_bytes <= $4)
         )
       RETURNING id, mime, size_bytes`,
      [reportId, input.fileTokens, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES],
    );

    if (claimed.rowCount !== input.fileTokens.length) {
      throw new ReportError("One or more proof uploads expired. Please upload them again.", 422, {
        proof: "Upload the proof files again and resubmit.",
      });
    }

    return {
      id: reportId,
      displayId: displayReportId(reportId),
      kind: input.kind,
      status: "pending" as const,
      submitterUsername: input.submitterUsername,
      reportedUsername: input.reportedUsername,
      reason: input.reason,
      description: input.description,
      submittedAt: now,
      updatedAt: now,
      reviewedBy: null,
      fileCount: claimed.rows.length,
    };
  });
}

export async function setReportStatus(
  user: SessionUser,
  id: number,
  status: unknown,
): Promise<ReportDetail> {
  if (!isReportStatus(status)) throw new ReportError("Choose a valid report status.");
  const now = new Date().toISOString();
  const { rowCount } = await query(
    `UPDATE reports
     SET status = $1, reviewed_by_user_id = $2, reviewed_by_username = $3, updated_at = $4
     WHERE id = $5`,
    [status, user.id, user.username, now, id],
  );
  if (rowCount === 0) throw new ReportError("Report not found.", 404);
  const report = await getManagementReport(id);
  if (!report) throw new ReportError("Report not found.", 404);
  return report;
}

export async function addReportNote(
  user: SessionUser,
  id: number,
  rawBody: unknown,
): Promise<ReportNote[]> {
  const body = cleanText(rawBody, 2000);
  if (body.length < 2) throw new ReportError("Write a note before saving.");
  const { rowCount } = await query("SELECT 1 FROM reports WHERE id = $1", [id]);
  if (rowCount === 0) throw new ReportError("Report not found.", 404);

  await query(
    `INSERT INTO report_notes (report_id, author_user_id, author_username, body, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, user.id, user.username, body, new Date().toISOString()],
  );

  const { rows } = await query<ReportNoteRow>(
    `SELECT id, author_username, body, created_at
     FROM report_notes WHERE report_id = $1 ORDER BY created_at, id`,
    [id],
  );
  return rows.map((note) => ({
    id: note.id,
    authorUsername: note.author_username,
    body: note.body,
    createdAt: note.created_at,
  }));
}

export async function getReportFile(
  reportId: number,
  fileId: number,
): Promise<{ name: string; mime: string; sizeBytes: number; storage: string; storageKey: string } | null> {
  const { rows } = await query<{
    original_name: string;
    mime: string;
    size_bytes: number;
    storage: string;
    storage_key: string;
  }>(
    `SELECT original_name, mime, size_bytes, storage, storage_key
     FROM report_files WHERE id = $1 AND report_id = $2`,
    [fileId, reportId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    name: row.original_name,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes),
    storage: row.storage,
    storageKey: row.storage_key,
  };
}
