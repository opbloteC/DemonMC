import { unstable_cache } from "next/cache";
import { SITE_DATA_TAG } from "./cache";
import { query } from "./db";
import { RANK_JOINS, RANK_ORDER_SQL, RANK_SELECT, mapRankColumns, type RankColumns } from "./rank-query";
import { FALLBACK_RANK, isBadgeStyle, type RankInfo } from "./rank-types";
import { normalizeRole, normalizeSpecialRank } from "./ranks";
import type {
  Account,
  Announcement,
  AnnouncementAuthor,
  PlayerCategory,
  PlayerProfile,
  RankPlayer,
  StaffMember,
} from "./types";

interface StaffRow extends RankColumns {
  id: number;
  username: string;
  role: string;
  description: string;
  avatar_url: string | null;
  joined_at: string;
}

interface AccountRow extends StaffRow {
  special_rank: string | null;
  disabled: boolean;
  created_at: string;
}

interface PlayerRow {
  id: number;
  username: string;
  category: PlayerCategory;
  rank_label: string;
  description: string;
  avatar_url: string | null;
  joined_at: string;
}

interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
  author_user_id: number | null;
  author_username: string | null;
  author_minecraft_username: string | null;
  author_minecraft_uuid: string | null;
  author_avatar_url: string | null;
  author_rank_id: number | null;
  author_rank_key: string | null;
  author_rank_name: string | null;
  author_rank_color: string | null;
  author_rank_text_color: string | null;
  author_rank_bold: boolean | null;
  author_rank_badge_style: string | null;
  author_rank_display_order: number | null;
}

interface RankRow extends RankColumns {
  id: number;
  username: string;
  login_username: string;
  role: string;
  special_rank: string | null;
  avatar_url: string | null;
  disabled: boolean;
}

const ANNOUNCEMENT_SELECT = `
  a.id, a.title, a.body, a.pinned, a.published, a.created_at, a.updated_at,
  a.author_user_id,
  au.username AS author_username,
  au.minecraft_username AS author_minecraft_username,
  au.minecraft_uuid AS author_minecraft_uuid,
  au.avatar_url AS author_avatar_url,
  ar.id AS author_rank_id,
  ar.key AS author_rank_key,
  ar.name AS author_rank_name,
  ar.color AS author_rank_color,
  ar.text_color AS author_rank_text_color,
  ar.bold AS author_rank_bold,
  ar.badge_style AS author_rank_badge_style,
  ar.display_order AS author_rank_display_order`;

const ANNOUNCEMENT_JOINS = `
  LEFT JOIN users au ON au.id = a.author_user_id
  LEFT JOIN ranks ar ON ar.id = au.rank_id`;

function mapAuthor(row: AnnouncementRow): AnnouncementAuthor | null {
  if (!row.author_user_id || !row.author_username) return null;
  const rank: RankInfo = row.author_rank_id && row.author_rank_key && row.author_rank_name
    ? {
        id: row.author_rank_id,
        key: row.author_rank_key,
        name: row.author_rank_name,
        color: row.author_rank_color ?? FALLBACK_RANK.color,
        textColor: row.author_rank_text_color ?? FALLBACK_RANK.textColor,
        bold: Boolean(row.author_rank_bold),
        badgeStyle: isBadgeStyle(row.author_rank_badge_style) ? row.author_rank_badge_style : "solid",
        displayOrder: row.author_rank_display_order ?? FALLBACK_RANK.displayOrder,
      }
    : FALLBACK_RANK;
  return {
    id: row.author_user_id,
    username: row.author_username,
    minecraftUsername: row.author_minecraft_username,
    minecraftUuid: row.author_minecraft_uuid,
    avatarUrl: row.author_avatar_url,
    rank,
  };
}

export function mapStaff(row: StaffRow): StaffMember {
  const { rank, secondaryRank } = mapRankColumns(row);
  return {
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role),
    rank,
    secondaryRank,
    description: row.description,
    avatarUrl: row.avatar_url,
    joinedAt: row.joined_at,
  };
}

export function mapAccount(row: AccountRow): Account {
  const { rank, secondaryRank } = mapRankColumns(row);
  return {
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role),
    specialRank: normalizeSpecialRank(row.special_rank),
    rank,
    secondaryRank,
    disabled: Boolean(row.disabled),
    description: row.description,
    avatarUrl: row.avatar_url,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
  };
}

export function mapPlayer(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    username: row.username,
    category: row.category,
    rankLabel: row.rank_label,
    description: row.description,
    avatarUrl: row.avatar_url,
    joinedAt: row.joined_at,
  };
}

export function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: Boolean(row.pinned),
    published: Boolean(row.published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: mapAuthor(row),
  };
}

export async function listStaff(): Promise<StaffMember[]> {
  const { rows } = await query<StaffRow>(
    `SELECT u.id, u.username, u.role, u.description, u.avatar_url, u.joined_at,
            ${RANK_SELECT}
     FROM users u
     ${RANK_JOINS}
     WHERE u.disabled = FALSE
       AND (
         lower(u.username) = 'opblote'
         OR EXISTS (
           SELECT 1 FROM rank_permissions rp
           WHERE rp.rank_id = u.rank_id
             AND rp.permission_key = 'staff_workspace.access'
             AND rp.allowed = TRUE
         )
       )
     ORDER BY ${RANK_ORDER_SQL}`,
  );
  return rows.map(mapStaff);
}

export async function listAccounts(): Promise<Account[]> {
  const { rows } = await query<AccountRow>(
    `SELECT u.id, u.username, u.role, u.special_rank, u.disabled, u.description,
            u.avatar_url, u.joined_at, u.created_at,
            ${RANK_SELECT}
     FROM users u
     ${RANK_JOINS}
     ORDER BY ${RANK_ORDER_SQL}`,
  );
  return rows.map(mapAccount);
}

export async function getAccount(id: number): Promise<Account | null> {
  const { rows } = await query<AccountRow>(
    `SELECT u.id, u.username, u.role, u.special_rank, u.disabled, u.description,
            u.avatar_url, u.joined_at, u.created_at,
            ${RANK_SELECT}
     FROM users u
     ${RANK_JOINS}
     WHERE u.id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? mapAccount(row) : null;
}

export async function listPlayers(): Promise<PlayerProfile[]> {
  const { rows } = await query<PlayerRow>(
    `SELECT id, username, category, rank_label, description, avatar_url, joined_at
     FROM players ORDER BY lower(username)`,
  );
  return rows.map(mapPlayer);
}

export async function listAnnouncements(limit?: number, publicOnly = false): Promise<Announcement[]> {
  const where = publicOnly ? "WHERE a.published = TRUE" : "";
  const sql =
    `SELECT ${ANNOUNCEMENT_SELECT}
     FROM announcements a
     ${ANNOUNCEMENT_JOINS}
     ${where}
     ORDER BY a.pinned DESC, a.created_at DESC, a.id DESC` + (limit ? " LIMIT $1" : "");
  const result = limit
    ? await query<AnnouncementRow>(sql, [limit])
    : await query<AnnouncementRow>(sql);
  return result.rows.map(mapAnnouncement);
}

async function readPublicAnnouncements(limit: number): Promise<Announcement[]> {
  return listAnnouncements(limit > 0 ? limit : undefined, true);
}

const publicAnnouncementsCache = unstable_cache(
  readPublicAnnouncements,
  ["public-announcements"],
  { tags: [SITE_DATA_TAG], revalidate: 30 },
);

export function listPublicAnnouncements(limit?: number): Promise<Announcement[]> {
  return publicAnnouncementsCache(limit ?? 0);
}

export async function getAnnouncement(id: number): Promise<Announcement | null> {
  const { rows } = await query<AnnouncementRow>(
    `SELECT ${ANNOUNCEMENT_SELECT}
     FROM announcements a
     ${ANNOUNCEMENT_JOINS}
     WHERE a.id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? mapAnnouncement(row) : null;
}

export async function getPlayer(id: number): Promise<PlayerProfile | null> {
  const { rows } = await query<PlayerRow>(
    `SELECT id, username, category, rank_label, description, avatar_url, joined_at
     FROM players WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? mapPlayer(row) : null;
}

export async function countRows(): Promise<{
  players: number;
  accounts: number;
  announcements: number;
}> {
  const [players, accounts, announcements] = await Promise.all([
    query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM users WHERE disabled = FALSE AND minecraft_username IS NOT NULL",
    ),
    query<{ count: number }>("SELECT COUNT(*)::int AS count FROM users"),
    query<{ count: number }>("SELECT COUNT(*)::int AS count FROM announcements"),
  ]);
  return {
    players: players.rows[0].count,
    accounts: accounts.rows[0].count,
    announcements: announcements.rows[0].count,
  };
}

function mapRankPlayer(row: RankRow): RankPlayer {
  const { rank, secondaryRank } = mapRankColumns(row);
  return {
    id: row.id,
    username: row.username,
    loginUsername: row.login_username,
    role: normalizeRole(row.role),
    specialRank: normalizeSpecialRank(row.special_rank),
    rank,
    secondaryRank,
    avatarUrl: row.avatar_url,
    disabled: Boolean(row.disabled),
    isOwner: row.login_username.trim().toLowerCase() === "opblote",
    overrides: [],
    effectivePermissions: [],
    permissionSources: [],
  };
}

export async function listRankPlayers(): Promise<RankPlayer[]> {
  const { rows } = await query<RankRow>(
    `SELECT u.id, COALESCE(u.minecraft_username, u.username) AS username,
            u.username AS login_username, u.role, u.special_rank, u.avatar_url, u.disabled,
            ${RANK_SELECT}
     FROM users u
     ${RANK_JOINS}
     ORDER BY ${RANK_ORDER_SQL}`,
  );
  return rows.map(mapRankPlayer);
}

export async function getRankPlayer(id: number): Promise<RankPlayer | null> {
  const { rows } = await query<RankRow>(
    `SELECT u.id, COALESCE(u.minecraft_username, u.username) AS username,
            u.username AS login_username, u.role, u.special_rank, u.avatar_url, u.disabled,
            ${RANK_SELECT}
     FROM users u
     ${RANK_JOINS}
     WHERE u.id = $1`,
    [id],
  );
  return rows[0] ? mapRankPlayer(rows[0]) : null;
}
