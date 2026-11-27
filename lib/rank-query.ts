import { FALLBACK_RANK, isBadgeStyle, type RankInfo } from "./rank-types";

export interface RankColumns {
  rank_id: number | null;
  rank_key: string | null;
  rank_name: string | null;
  rank_color: string | null;
  rank_text_color: string | null;
  rank_bold: boolean | null;
  rank_badge_style: string | null;
  rank_display_order: number | null;
  secondary_rank_id: number | null;
  secondary_rank_key: string | null;
  secondary_rank_name: string | null;
  secondary_rank_color: string | null;
  secondary_rank_text_color: string | null;
  secondary_rank_bold: boolean | null;
  secondary_rank_badge_style: string | null;
  secondary_rank_display_order: number | null;
}

export const RANK_SELECT = `
  r.id AS rank_id,
  r.key AS rank_key,
  r.name AS rank_name,
  r.color AS rank_color,
  r.text_color AS rank_text_color,
  r.bold AS rank_bold,
  r.badge_style AS rank_badge_style,
  r.display_order AS rank_display_order,
  sr.id AS secondary_rank_id,
  sr.key AS secondary_rank_key,
  sr.name AS secondary_rank_name,
  sr.color AS secondary_rank_color,
  sr.text_color AS secondary_rank_text_color,
  sr.bold AS secondary_rank_bold,
  sr.badge_style AS secondary_rank_badge_style,
  sr.display_order AS secondary_rank_display_order`;

export const RANK_JOINS = `
  LEFT JOIN ranks r ON r.id = u.rank_id
  LEFT JOIN ranks sr ON sr.id = u.secondary_rank_id`;

export const RANK_ORDER_SQL = "r.display_order ASC NULLS LAST, lower(r.name) ASC NULLS LAST, lower(u.username)";

export function mapRankColumns(row: RankColumns): {
  rank: RankInfo;
  secondaryRank: RankInfo | null;
} {
  const rank: RankInfo =
    row.rank_id && row.rank_key && row.rank_name
      ? {
          id: row.rank_id,
          key: row.rank_key,
          name: row.rank_name,
          color: row.rank_color ?? FALLBACK_RANK.color,
          textColor: row.rank_text_color ?? FALLBACK_RANK.textColor,
          bold: Boolean(row.rank_bold),
          badgeStyle: isBadgeStyle(row.rank_badge_style) ? row.rank_badge_style : "solid",
          displayOrder: row.rank_display_order ?? FALLBACK_RANK.displayOrder,
        }
      : FALLBACK_RANK;

  const secondaryRank: RankInfo | null =
    row.secondary_rank_id && row.secondary_rank_key && row.secondary_rank_name
      ? {
          id: row.secondary_rank_id,
          key: row.secondary_rank_key,
          name: row.secondary_rank_name,
          color: row.secondary_rank_color ?? FALLBACK_RANK.color,
          textColor: row.secondary_rank_text_color ?? FALLBACK_RANK.textColor,
          bold: Boolean(row.secondary_rank_bold),
          badgeStyle: isBadgeStyle(row.secondary_rank_badge_style)
            ? row.secondary_rank_badge_style
            : "solid",
          displayOrder: row.secondary_rank_display_order ?? FALLBACK_RANK.displayOrder,
        }
      : null;

  return { rank, secondaryRank };
}
