import { NextResponse } from "next/server";
import { jsonError, mutationGuard, readJson, requireOwner } from "@/lib/api";
import { getServerStatus } from "@/lib/minecraft";
import { isOwnerAccount } from "@/lib/ranks";
import {
  getOwnerStatusSetting,
  isOwnerServerStatus,
  saveOwnerStatus,
} from "@/lib/server-status";
import { getSettings } from "@/lib/settings";
import { MAX_STATUS_MESSAGE } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize() {
  const auth = await requireOwner();
  if (auth.response) return auth;
  return auth;
}

export async function GET() {
  const auth = await authorize();
  if (auth.response) return auth.response;
  if (!isOwnerAccount(auth.user)) {
    return jsonError("Only the owner account can read the server status controls.", 403);
  }

  const [{ status, message }, settings] = await Promise.all([
    getOwnerStatusSetting(),
    getSettings(),
  ]);
  const minecraft = await getServerStatus(settings.ip);

  return NextResponse.json(
    {
      status,
      message,
      minecraft: {
        reachable: minecraft.reachable,
        online: minecraft.online,
        version: minecraft.version,
        checkedAt: minecraft.checkedAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  if (!isOwnerAccount(auth.user)) {
    return jsonError("Only the owner account can change the server status.", 403);
  }

  const guard = mutationGuard(req);
  if (guard) return guard;

  const body = await readJson(req);
  if (!body) return jsonError("Invalid request body.");

  if (!isOwnerServerStatus(body.status)) {
    return jsonError("Choose one of the three allowed statuses: online, offline or maintenance.", 422);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length > MAX_STATUS_MESSAGE) {
    return jsonError(`Maintenance message must be ${MAX_STATUS_MESSAGE} characters or fewer.`, 422);
  }

  await saveOwnerStatus(body.status, message);

  return NextResponse.json(
    { ok: true, status: body.status, message },
    { headers: { "Cache-Control": "no-store" } },
  );
}
