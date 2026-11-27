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
import { getAnnouncement, listAnnouncements } from "@/lib/queries";
import { recordAudit } from "@/lib/rank-admin";
import { userCan } from "@/lib/types";
import { text } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = [
  "announcements.view",
  "announcements.create",
  "announcements.edit",
  "announcements.delete",
  "announcements.publish",
  "announcements.pin",
] as const;

export async function GET() {
  const auth = await requireAnyPermission(VIEW_PERMISSIONS);
  if (auth.response) return auth.response;

  return NextResponse.json(
    { announcements: await listAnnouncements() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const auth = await requirePermission("announcements.create");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  const title = text(body.title, 3, 120);
  if (!title) return jsonError("Title must be between 3 and 120 characters.", 422);

  const announcementBody = text(body.body, 3, 2000);
  if (!announcementBody) return jsonError("Announcement text must be between 3 and 2000 characters.", 422);

  if ("published" in body && typeof body.published !== "boolean") {
    return jsonError("Published must be true or false.", 422);
  }
  const canPublish = userCan(auth.user, "announcements.publish");
  const published = typeof body.published === "boolean" ? body.published : canPublish;
  if (published && !canPublish) {
    return jsonError("You do not have permission to publish announcements.", 403);
  }

  const now = new Date().toISOString();
  const { rows } = await query<{ id: number }>(
    `INSERT INTO announcements (
       title, body, pinned, published, author_user_id, created_at, updated_at
     )
     VALUES ($1, $2, FALSE, $3, $4, $5, $6)
     RETURNING id`,
    [title, announcementBody, published, auth.user.id, now, now],
  );

  const announcement = await getAnnouncement(rows[0].id);
  await recordAudit(auth.user, "announcement.create", `Created announcement “${title}”.`);
  invalidateSiteData();
  return NextResponse.json({ announcement }, { status: 201 });
}
