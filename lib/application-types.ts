export const APPLICATION_CATEGORIES = ["staff", "media"] as const;
export type ApplicationCategory = (typeof APPLICATION_CATEGORIES)[number];

export const APPLICATION_STATUSES = ["pending", "accepted", "denied"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "dropdown",
  "multiple_choice",
  "checkboxes",
  "yes_no",
] as const;
export type ApplicationQuestionType = (typeof APPLICATION_QUESTION_TYPES)[number];

export const APPLICATION_QUESTION_TYPE_LABELS: Record<ApplicationQuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  dropdown: "Dropdown",
  multiple_choice: "Multiple choice",
  checkboxes: "Checkboxes",
  yes_no: "Yes / No",
};

export const APPLICATION_CATEGORY_META: Record<
  ApplicationCategory,
  { label: string; cardTitle: string; description: string; icon: "shield" | "media" }
> = {
  staff: {
    label: "Staff Apply",
    cardTitle: "Staff Apply",
    description: "Support players, keep the community welcoming, and help the server run smoothly.",
    icon: "shield",
  },
  media: {
    label: "Media Apply",
    cardTitle: "Media Apply",
    description: "Create videos, streams, and content that introduce DemonMC to new players.",
    icon: "media",
  },
};

export interface ApplicationQuestion {
  id: number | null;
  title: string;
  description: string;
  type: ApplicationQuestionType;
  required: boolean;
  options: string[];
  identityKey?: "minecraft" | "discord" | null;
}

export interface ApplicationSection {
  id: number | null;
  title: string;
  questions: ApplicationQuestion[];
}

export interface ApplicationForm {
  id: number;
  category: ApplicationCategory;
  title: string;
  description: string;
  submitLabel: string;
  closingMessage: string;
  enabled: boolean;
  allowReapplyAfterDenial: boolean;
  reapplyWaitHours: number;
  version: number;
  sections: ApplicationSection[];
}

export type ApplicationAnswerValue = string | string[];
export type ApplicationAnswers = Record<string, ApplicationAnswerValue>;

export interface ApplicationSubmissionSummary {
  id: number;
  displayId: string;
  category: ApplicationCategory;
  status: ApplicationStatus;
  minecraftUsername: string;
  discordUsername: string;
  submittedAt: string;
  decidedAt: string | null;
  denialReason: string | null;
}

export interface ApplicationHistoryEntry {
  id: number;
  action: string;
  actorUsername: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus | null;
  reason: string;
  createdAt: string;
}

export interface ApplicationReviewNote {
  id: number;
  body: string;
  authorUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSubmissionDetail extends ApplicationSubmissionSummary {
  applicantUsername: string;
  answers: ApplicationAnswers;
  formSnapshot: ApplicationForm;
  reviewedBy: string | null;
  history: ApplicationHistoryEntry[];
  notes: ApplicationReviewNote[];
}

export interface ApplicationEligibility {
  category: ApplicationCategory;
  enabled: boolean;
  canApply: boolean;
  message: string;
  latestStatus: ApplicationStatus | null;
  retryAt: string | null;
}

export interface ApplicationManagementState {
  forms: ApplicationForm[];
  pendingCounts: Record<ApplicationCategory, number>;
}

export function isApplicationCategory(value: unknown): value is ApplicationCategory {
  return typeof value === "string" && (APPLICATION_CATEGORIES as readonly string[]).includes(value);
}

export function isApplicationQuestionType(value: unknown): value is ApplicationQuestionType {
  return typeof value === "string" && (APPLICATION_QUESTION_TYPES as readonly string[]).includes(value);
}

export function applicationDisplayId(id: number): string {
  return `DMC-${String(id).padStart(6, "0")}`;
}
