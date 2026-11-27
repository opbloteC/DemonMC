import { NextResponse } from "next/server";
import {
  jsonError,
  mutationGuard,
  readJson,
  requireAnyPermission,
  requirePermission,
} from "@/lib/api";
import { invalidateSiteData } from "@/lib/cache";
import { query } from "@/lib/db";
import { getAnnouncement } from "@/lib/queries";
import { recordAudit } from "@/lib/rank-admin";
import { userCan } from "@/lib/types";
import { text } from "@/lib/validation";

export const runtime = "nodejs";

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPermission([
    "announcements.edit",
    "announcements.pin",
    "announcements.publish",
  ]);
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid announcement id.", 400);
  if (!(await getAnnouncement(id))) return jsonError("Announcement not found.", 404);

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const changesText = "title" in body || "body" in body;
  if (changesText && !userCan(auth.user, "announcements.edit")) {
    return jsonError("You do not have permission to edit announcements.", 403);
  }
  if ("pinned" in body && !userCan(auth.user, "announcements.pin")) {
    return jsonError("You do not have permission to pin announcements.", 403);
  }
  if ("published" in body && !userCan(auth.user, "announcements.publish")) {
    return jsonError("You do not have permission to publish announcements.", 403);
  }

  const updates: string[] = [];
  const values: (string | boolean)[] = [];
  const addUpdate = (column: string, value: string | boolean) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if ("title" in body) {
    const title = text(body.title, 3, 120);
    if (!title) return jsonError("Title must be between 3 and 120 characters.", 422);
    addUpdate("title", title);
  }

  if ("body" in body) {
    const announcementBody = text(body.body, 3, 2000);
    if (!announcementBody) return jsonError("Announcement text must be between 3 and 2000 characters.", 422);
    addUpdate("body", announcementBody);
  }

  if ("pinned" in body) {
    if (typeof body.pinned !== "boolean") return jsonError("Pinned must be true or false.", 422);
    addUpdate("pinned", body.pinned);
  }

  if ("published" in body) {
    if (typeof body.published !== "boolean") {
      return jsonError("Published must be true or false.", 422);
    }
    addUpdate("published", body.published);
  }

  if (updates.length === 0) return jsonError("No changes provided.", 422);

  addUpdate("updated_at", new Date().toISOString());

  await query(
    `UPDATE announcements SET ${updates.join(", ")} WHERE id = $${values.length + 1}`,
    [...values, id],
  );

  const announcement = await getAnnouncement(id);
  await recordAudit(
    auth.user,
    "announcement.update",
    `Updated announcement “${announcement?.title ?? id}” (${Object.keys(body).join(", ")}).`,
  );
  invalidateSiteData();

  return NextResponse.json({ announcement });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("announcements.delete");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid announcement id.", 400);

  const existing = await getAnnouncement(id);
  const result = await query("DELETE FROM announcements WHERE id = $1", [id]);
  if (result.rowCount === 0) return jsonError("Announcement not found.", 404);

  await recordAudit(
    auth.user,
    "announcement.delete",
    `Deleted announcement “${existing?.title ?? id}”.`,
  );
  invalidateSiteData();

  return NextResponse.json({ ok: true });
}
