import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requirePermission } from "@/lib/api";
import { hashPassword, revokeUserSessions } from "@/lib/auth";
import { invalidateSiteData } from "@/lib/cache";
import { query } from "@/lib/db";
import { getAccount } from "@/lib/queries";
import { recordAudit } from "@/lib/rank-admin";
import { isOwnerAccount } from "@/lib/types";
import { isHttpUrl, isIsoDate, isStrongPassword, optionalText } from "@/lib/validation";

export const runtime = "nodejs";

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("accounts.manage");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid account id.", 400);

  const target = await getAccount(id);
  if (!target) return jsonError("Account not found.", 404);

  if (isOwnerAccount(target)) {
    return jsonError("The owner account is protected and cannot be managed here.", 403);
  }

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  if ("username" in body && body.username !== target.username) {
    return jsonError("Usernames cannot be changed.", 422);
  }

  if ("role" in body) {
    return jsonError(
      "Ranks are assigned in the Owner console. Use Player rank assignment instead.",
      422,
    );
  }

  if ("disabled" in body && body.disabled === true && id === auth.user.id) {
    return jsonError("You cannot disable your own account.", 403);
  }

  const updates: string[] = [];
  const values: (string | boolean | null)[] = [];
  const addUpdate = (column: string, value: string | boolean | null) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };
  let revokeSessions = false;

  if ("password" in body) {
    if (!isStrongPassword(body.password)) {
      return jsonError("Password must be 10–200 characters and include a letter and a number.", 422);
    }
    addUpdate("password_hash", await hashPassword(body.password));
    revokeSessions = true;
  }

  if ("disabled" in body) {
    if (typeof body.disabled !== "boolean") return jsonError("Invalid account status.", 422);
    addUpdate("disabled", body.disabled);
    if (body.disabled) revokeSessions = true;
  }

  if ("description" in body) {
    const description = optionalText(body.description, 300);
    if (description === null) return jsonError("Description is too long.", 422);
    addUpdate("description", description);
  }

  if ("joinedAt" in body) {
    if (!isIsoDate(body.joinedAt)) return jsonError("Joined date must be a valid date.", 422);
    addUpdate("joined_at", body.joinedAt);
  }

  if ("avatarUrl" in body) {
    if (body.avatarUrl === "" || body.avatarUrl === null) {
      addUpdate("avatar_url", null);
    } else if (isHttpUrl(body.avatarUrl)) {
      addUpdate("avatar_url", body.avatarUrl);
    } else {
      return jsonError("Avatar URL must be a valid http(s) link.", 422);
    }
  }

  if (updates.length === 0) return jsonError("No changes provided.", 422);

  await query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length + 1}`,
    [...values, id],
  );

  if (revokeSessions) await revokeUserSessions(id);

  invalidateSiteData();

  await recordAudit(
    auth.user,
    "account.update",
    `Updated account ${target.username} (${Object.keys(body).join(", ")}).`,
    { id: target.id, username: target.username },
  );

  return NextResponse.json(
    { account: await getAccount(id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("accounts.manage");
  if (auth.response) return auth.response;

  const guard = mutationGuard(req);
  if (guard) return guard;

  const id = await parseId(params);
  if (!id) return jsonError("Invalid account id.", 400);

  const target = await getAccount(id);
  if (!target) return jsonError("Account not found.", 404);

  if (isOwnerAccount(target)) {
    return jsonError("The owner account cannot be deleted.", 403);
  }
  if (id === auth.user.id) {
    return jsonError("You cannot delete your own account.", 403);
  }

  await query("DELETE FROM users WHERE id = $1", [id]);
  invalidateSiteData();
  await recordAudit(auth.user, "account.delete", `Deleted account ${target.username}.`, {
    id: target.id,
    username: target.username,
  });
  return NextResponse.json({ ok: true });
}
