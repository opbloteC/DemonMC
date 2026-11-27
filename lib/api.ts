import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import { isOwnerAccount, userCan, type SessionUser } from "./types";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const data = await req.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required.", 401) };
  return { user };
}

export async function requirePermission(
  permission: string,
): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required.", 401) };
  if (!userCan(user, permission)) {
    return { response: jsonError("You do not have permission to perform this action.", 403) };
  }
  return { user };
}

export async function requireAnyPermission(
  permissions: readonly string[],
): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required.", 401) };
  if (!permissions.some((permission) => userCan(user, permission))) {
    return { response: jsonError("You do not have permission to perform this action.", 403) };
  }
  return { user };
}

export async function requireApplicationManager(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required.", 401) };
  const seniorRole = user.role === "owner" || user.role === "manager" || user.role === "developer";
  if (!seniorRole || !userCan(user, "applications.manage")) {
    return { response: jsonError("You do not have permission to manage applications.", 403) };
  }
  return { user };
}

export async function requireReportManager(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required.", 401) };
  const seniorRole = user.role === "owner" || user.role === "manager" || user.role === "developer";
  if (!seniorRole || !userCan(user, "moderation.view")) {
    return { response: jsonError("You do not have permission to manage reports.", 403) };
  }
  return { user };
}

/** Store management: the owner, managers and developers only. */
export async function requireStoreManager(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required.", 401) };
  const seniorRole =
    isOwnerAccount(user) || user.role === "manager" || user.role === "developer";
  if (!seniorRole) {
    return { response: jsonError("You do not have permission to manage the store.", 403) };
  }
  return { user };
}

export async function requireStaff(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  return requireAnyPermission(["staff_workspace.access", "staff_panel.access"]);
}

export async function requireAdmin(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  return requirePermission("staff_panel.access");
}

export async function requireOwner(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required.", 401) };
  if (!isOwnerAccount(user)) {
    return { response: jsonError("Only the owner can perform this action.", 403) };
  }
  return { user };
}

/** Owner-only tools require the designated owner login account. */
export async function requireOwnerAccount(): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  return requireOwner();
}

export function mutationGuard(req: Request): NextResponse | null {
  if (!sameOrigin(req)) return jsonError("Invalid request origin.", 403);
  return null;
}
