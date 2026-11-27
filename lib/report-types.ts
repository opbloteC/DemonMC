export const REPORT_KINDS = ["player", "bug"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_STATUSES = ["pending", "reviewing", "resolved", "rejected"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_KIND_META: Record<
  ReportKind,
  { label: string; cardTitle: string; description: string }
> = {
  player: {
    label: "Player Report",
    cardTitle: "Player Report",
    description:
      "Report a player for cheating, abuse, harassment, bad behaviour or breaking a server rule. Attach a screenshot or clip as proof.",
  },
  bug: {
    label: "Bug Report",
    cardTitle: "Bug Report",
    description:
      "Found a broken feature, item or website issue? Describe what happened and attach a screenshot or recording so the team can reproduce it.",
  },
};

export const REPORT_STATUS_META: Record<ReportStatus, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  reviewing: { label: "Reviewing", tone: "border-sky-200 bg-sky-50 text-sky-700" },
  resolved: { label: "Resolved", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", tone: "border-red-200 bg-red-50 text-red-600" },
};

export type ReportMediaKind = "image" | "video";

export interface PendingReportFile {
  token: string;
  name: string;
  mime: string;
  sizeBytes: number;
  mediaKind: ReportMediaKind;
}

export interface ReportFileSummary {
  id: number;
  name: string;
  mime: string;
  sizeBytes: number;
  mediaKind: ReportMediaKind;
  url: string;
}

export interface ReportNote {
  id: number;
  authorUsername: string;
  body: string;
  createdAt: string;
}

export interface ReportSummary {
  id: number;
  displayId: string;
  kind: ReportKind;
  status: ReportStatus;
  submitterUsername: string;
  reportedUsername: string | null;
  reason: string;
  description: string;
  submittedAt: string;
  updatedAt: string;
  reviewedBy: string | null;
  fileCount: number;
}

export interface ReportDetail extends ReportSummary {
  files: ReportFileSummary[];
  notes: ReportNote[];
}

export interface ReportListPage {
  reports: ReportSummary[];
  nextOffset: number | null;
  counts: Record<ReportKind, Record<ReportStatus, number>>;
}

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === "string" && (REPORT_KINDS as readonly string[]).includes(value);
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);
}

export function displayReportId(id: number): string {
  return `RPT-${String(id).padStart(6, "0")}`;
}
