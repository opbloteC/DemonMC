import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { isUniqueViolation, query, withTransaction } from "./db";
import {
  applicationDisplayId,
  isApplicationCategory,
  type ApplicationAnswers,
  type ApplicationCategory,
  type ApplicationEligibility,
  type ApplicationForm,
  type ApplicationHistoryEntry,
  type ApplicationQuestion,
  type ApplicationQuestionType,
  type ApplicationReviewNote,
  type ApplicationSection,
  type ApplicationStatus,
  type ApplicationSubmissionDetail,
  type ApplicationSubmissionSummary,
} from "./application-types";
import {
  ApplicationInputError,
  parseApplicationFormInput,
  validateApplicationAnswers,
  type ApplicationFormInput,
} from "./application-validation";
import { userCan, type SessionUser } from "./types";

interface Executor {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

const database: Executor = {
  async query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
    return query<T>(text, params);
  },
};

interface FormRow {
  id: number;
  category: ApplicationCategory;
  title: string;
  description: string;
  submit_label: string;
  closing_message: string;
  enabled: boolean;
  allow_reapply_after_denial: boolean;
  reapply_wait_hours: number;
  version: number;
}

interface SectionRow {
  id: number;
  form_id: number;
  title: string;
}

interface QuestionRow {
  id: number;
  section_id: number;
  title: string;
  description: string;
  question_type: ApplicationQuestionType;
  required: boolean;
  options: unknown;
  identity_key: "minecraft" | "discord" | null;
}

interface SubmissionRow {
  id: number;
  user_id: number;
  form_id: number;
  category: ApplicationCategory;
  status: ApplicationStatus;
  minecraft_username: string;
  discord_username: string;
  answers: ApplicationAnswers;
  form_snapshot: ApplicationForm;
  reviewed_by_username: string | null;
  denial_reason: string | null;
  submitted_at: string;
  decided_at: string | null;
  applicant_username?: string;
}

interface HistoryRow {
  id: number;
  action: string;
  actor_username: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus | null;
  reason: string;
  created_at: string;
}

interface NoteRow {
  id: number;
  body: string;
  author_username: string;
  created_at: string;
  updated_at: string;
}

export class ApplicationError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status = 422, fields?: Record<string, string>) {
    super(message);
    this.name = "ApplicationError";
    this.status = status;
    this.fields = fields;
  }
}

export function canManageApplications(user: SessionUser): boolean {
  const seniorRole = user.role === "owner" || user.role === "manager" || user.role === "developer";
  return seniorRole && userCan(user, "applications.manage");
}

function questionOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function readForms(executor: Executor, category?: ApplicationCategory): Promise<ApplicationForm[]> {
  const params: unknown[] = [];
  const conditions = ["f.archived_at IS NULL"];
  if (category) {
    params.push(category);
    conditions.push(`f.category = $${params.length}`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const [formResult, sectionResult, questionResult] = await Promise.all([
    executor.query<FormRow>(
      `SELECT f.id, f.category, f.title, f.description, f.submit_label, f.closing_message, f.enabled,
              f.allow_reapply_after_denial, f.reapply_wait_hours, f.version
       FROM application_forms f ${where}
       ORDER BY CASE f.category WHEN 'staff' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, f.id`,
      params,
    ),
    executor.query<SectionRow>(
      `SELECT s.id, s.form_id, s.title
       FROM application_sections s
       JOIN application_forms f ON f.id = s.form_id
       ${where}
       ORDER BY s.form_id, s.display_order, s.id`,
      params,
    ),
    executor.query<QuestionRow>(
      `SELECT q.id, q.section_id, q.title, q.description, q.question_type, q.required, q.options,
              q.identity_key
       FROM application_questions q
       JOIN application_sections s ON s.id = q.section_id
       JOIN application_forms f ON f.id = s.form_id
       ${where}
       ORDER BY q.section_id, q.display_order, q.id`,
      params,
    ),
  ]);

  const sectionsByForm = new Map<number, ApplicationSection[]>();
  const sectionForms = new Map(sectionResult.rows.map((section) => [section.id, section.form_id]));
  for (const section of sectionResult.rows) {
    const sections = sectionsByForm.get(section.form_id) ?? [];
    sections.push({ id: section.id, title: section.title, questions: [] });
    sectionsByForm.set(section.form_id, sections);
  }
  for (const question of questionResult.rows) {
    const formId = sectionForms.get(question.section_id);
    if (formId === undefined) continue;
    const section = sectionsByForm.get(formId)?.find((item) => item.id === question.section_id);
    if (!section) continue;
    section.questions.push({
      id: question.id,
      title: question.title,
      description: question.description,
      type: question.question_type,
      required: Boolean(question.required),
      options: questionOptions(question.options),
      identityKey: question.identity_key,
    });
  }

  return formResult.rows.map((form) => ({
    id: form.id,
    category: form.category,
    title: form.title,
    description: form.description,
    submitLabel: form.submit_label,
    closingMessage: form.closing_message,
    enabled: Boolean(form.enabled),
    allowReapplyAfterDenial: Boolean(form.allow_reapply_after_denial),
    reapplyWaitHours: form.reapply_wait_hours,
    version: form.version,
    sections: sectionsByForm.get(form.id) ?? [],
  }));
}

function mapSummary(row: SubmissionRow): ApplicationSubmissionSummary {
  return {
    id: row.id,
    displayId: applicationDisplayId(row.id),
    category: row.category,
    status: row.status,
    minecraftUsername: row.minecraft_username,
    discordUsername: row.discord_username,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    denialReason: row.denial_reason,
  };
}

function eligibilityFor(
  form: ApplicationForm,
  latest: SubmissionRow | undefined,
  signedIn: boolean,
): ApplicationEligibility {
  const base = { category: form.category, enabled: form.enabled, latestStatus: latest?.status ?? null, retryAt: null };
  if (!form.enabled) return { ...base, canApply: false, message: form.closingMessage || "Applications are currently closed." };
  if (!signedIn) return { ...base, canApply: false, message: "Sign in with your DemonMC account to apply." };
  if (!latest) return { ...base, canApply: true, message: "Applications are open." };
  if (latest.status === "pending") return { ...base, canApply: false, message: "Your application is awaiting review." };
  if (latest.status === "accepted") return { ...base, canApply: false, message: "Your application was accepted." };
  if (!form.allowReapplyAfterDenial) {
    return { ...base, canApply: false, message: "Management is not accepting another application after a denial." };
  }
  const retryAt = latest.decided_at
    ? new Date(new Date(latest.decided_at).getTime() + form.reapplyWaitHours * 3_600_000).toISOString()
    : null;
  if (retryAt && new Date(retryAt).getTime() > Date.now()) {
    return {
      ...base,
      canApply: false,
      retryAt,
      message: `You can apply again after ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(retryAt))} UTC.`,
    };
  }
  return { ...base, canApply: true, retryAt, message: "You can submit a new application." };
}

export interface PublicApplicationState {
  forms: ApplicationForm[];
  submissions: ApplicationSubmissionSummary[];
  eligibility: ApplicationEligibility[];
}

export async function listPublicApplicationState(userId: number | null): Promise<PublicApplicationState> {
  const forms = await readForms(database);
  const submissions = userId ? await listMySubmissions(userId) : [];
  const latestRows = userId
    ? (await query<SubmissionRow>(
        `SELECT DISTINCT ON (category) id, user_id, form_id, category, status, minecraft_username,
                discord_username, answers, form_snapshot, reviewed_by_username, denial_reason,
                submitted_at, decided_at
         FROM application_submissions
         WHERE user_id = $1
         ORDER BY category, submitted_at DESC, id DESC`,
        [userId],
      )).rows
    : [];
  const latestByCategory = new Map(latestRows.map((row) => [row.category, row]));
  return {
    forms,
    submissions,
    eligibility: forms.map((form) => eligibilityFor(form, latestByCategory.get(form.category), userId !== null)),
  };
}

export async function listMySubmissions(userId: number): Promise<ApplicationSubmissionSummary[]> {
  const { rows } = await query<SubmissionRow>(
    `SELECT id, category, status, minecraft_username, discord_username, submitted_at, decided_at, denial_reason
     FROM application_submissions
     WHERE user_id = $1
     ORDER BY submitted_at DESC, id DESC`,
    [userId],
  );
  return rows.map(mapSummary);
}

async function readHistory(executor: Executor, submissionId: number): Promise<ApplicationHistoryEntry[]> {
  const { rows } = await executor.query<HistoryRow>(
    `SELECT id, action, actor_username, from_status, to_status, reason, created_at
     FROM application_history WHERE submission_id = $1 ORDER BY created_at, id`,
    [submissionId],
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorUsername: row.actor_username,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

async function readNotes(executor: Executor, submissionId: number): Promise<ApplicationReviewNote[]> {
  const { rows } = await executor.query<NoteRow>(
    `SELECT id, body, author_username, created_at, updated_at
     FROM application_review_notes WHERE submission_id = $1 ORDER BY created_at, id`,
    [submissionId],
  );
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    authorUsername: row.author_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapDetail(row: SubmissionRow, history: ApplicationHistoryEntry[], notes: ApplicationReviewNote[]): ApplicationSubmissionDetail {
  return {
    ...mapSummary(row),
    applicantUsername: row.applicant_username ?? row.minecraft_username,
    answers: row.answers,
    formSnapshot: row.form_snapshot,
    reviewedBy: row.reviewed_by_username,
    history,
    notes,
  };
}

export async function getMySubmission(userId: number, submissionId: number): Promise<ApplicationSubmissionDetail | null> {
  const { rows } = await query<SubmissionRow & { applicant_username: string }>(
    `SELECT s.id, s.user_id, s.category, s.status, s.minecraft_username, s.discord_username,
            s.answers, s.form_snapshot, s.reviewed_by_username, s.denial_reason,
            s.submitted_at, s.decided_at, u.username AS applicant_username
     FROM application_submissions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.user_id = $2`,
    [submissionId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  const history = await readHistory(database, row.id);
  return mapDetail(row, history.filter((entry) => entry.action !== "note_added"), []);
}

export async function getManagementSubmission(submissionId: number): Promise<ApplicationSubmissionDetail | null> {
  const { rows } = await query<SubmissionRow & { applicant_username: string }>(
    `SELECT s.id, s.user_id, s.category, s.status, s.minecraft_username, s.discord_username,
            s.answers, s.form_snapshot, s.reviewed_by_username, s.denial_reason,
            s.submitted_at, s.decided_at, u.username AS applicant_username
     FROM application_submissions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [submissionId],
  );
  const row = rows[0];
  if (!row) return null;
  const [history, notes] = await Promise.all([readHistory(database, row.id), readNotes(database, row.id)]);
  return mapDetail(row, history, notes);
}

export interface ApplicationListFilters {
  category?: ApplicationCategory;
  status?: ApplicationStatus;
  search?: string;
  sort?: "newest" | "oldest";
  limit?: number;
  offset?: number;
}

export async function listManagementSubmissions(filters: ApplicationListFilters): Promise<{
  submissions: ApplicationSubmissionSummary[];
  nextOffset: number | null;
}> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.category) {
    params.push(filters.category);
    conditions.push(`s.category = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (filters.search) {
    const search = filters.search.trim().replace(/^DMC-/i, "").slice(0, 100);
    params.push(`%${search}%`);
    const usernameMatch = `(s.minecraft_username ILIKE $${params.length} OR s.discord_username ILIKE $${params.length})`;
    if (/^\d+$/.test(search)) {
      params.push(Number(search));
      conditions.push(`(${usernameMatch} OR s.id = $${params.length})`);
    } else {
      conditions.push(usernameMatch);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const direction = filters.sort === "oldest" ? "ASC" : "DESC";
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const offset = Math.max(0, filters.offset ?? 0);
  params.push(limit + 1, offset);
  const { rows } = await query<SubmissionRow>(
    `SELECT s.id, s.category, s.status, s.minecraft_username, s.discord_username,
            s.submitted_at, s.decided_at, s.denial_reason
     FROM application_submissions s ${where}
     ORDER BY s.submitted_at ${direction}, s.id ${direction}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    submissions: rows.slice(0, limit).map(mapSummary),
    nextOffset: rows.length > limit ? offset + limit : null,
  };
}

export async function listApplicationManagementState(): Promise<{ forms: ApplicationForm[]; pendingCounts: Record<ApplicationCategory, number> }> {
  const [forms, counts] = await Promise.all([
    readForms(database),
    query<{ category: ApplicationCategory; count: number }>(
      `SELECT category, COUNT(*)::int AS count FROM application_submissions
       WHERE status = 'pending' GROUP BY category`,
    ),
  ]);
  const pendingCounts: Record<ApplicationCategory, number> = { staff: 0, media: 0 };
  for (const row of counts.rows) pendingCounts[row.category] = row.count;
  return { forms, pendingCounts };
}

export async function submitApplication(
  user: SessionUser,
  category: ApplicationCategory,
  rawAnswers: unknown,
  version: number,
): Promise<ApplicationSubmissionSummary> {
  return withTransaction(async (client) => {
    const locked = await client.query<FormRow>(
      "SELECT * FROM application_forms WHERE category = $1 AND archived_at IS NULL FOR UPDATE",
      [category],
    );
    const formRow = locked.rows[0];
    if (!formRow) throw new ApplicationError("Application form not found.", 404);
    if (formRow.version !== version) {
      throw new ApplicationError("This form changed while you were completing it. Refresh and try again.", 409);
    }
    const form = (await readForms(client, category))[0];
    const latest = await client.query<SubmissionRow>(
      `SELECT * FROM application_submissions
       WHERE user_id = $1 AND category = $2
       ORDER BY submitted_at DESC, id DESC LIMIT 1`,
      [user.id, category],
    );
    const eligible = eligibilityFor(form, latest.rows[0], true);
    if (!eligible.canApply) throw new ApplicationError(eligible.message, 409);

    const account = await client.query<{ minecraft_username: string | null }>(
      "SELECT minecraft_username FROM users WHERE id = $1",
      [user.id],
    );
    const validated = validateApplicationAnswers(form, rawAnswers, account.rows[0]?.minecraft_username ?? null);
    if (Object.keys(validated.fieldErrors).length > 0) {
      throw new ApplicationError("Please correct the highlighted answers.", 422, validated.fieldErrors);
    }
    const minecraftUsername = validated.minecraftUsername || account.rows[0]?.minecraft_username || "";
    if (!minecraftUsername) throw new ApplicationError("A Minecraft username is required.");
    const discordUsername = validated.discordUsername || "Not provided";
    const now = new Date().toISOString();
    const actorUsername = user.minecraftUsername ?? user.username;

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO application_submissions (
         user_id, form_id, category, status, minecraft_username, discord_username,
         answers, form_snapshot, submitted_at
       ) VALUES ($1, $2, $3, 'pending', $4, $5, $6::jsonb, $7::jsonb, $8)
       RETURNING id`,
      [user.id, form.id, category, minecraftUsername, discordUsername, JSON.stringify(validated.answers), JSON.stringify(form), now],
    );
    const submissionId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO application_history (
         submission_id, actor_user_id, actor_username, action, to_status, reason, created_at
       ) VALUES ($1, $2, $3, 'submitted', 'pending', '', $4)`,
      [submissionId, user.id, actorUsername, now],
    );
    return {
      id: submissionId,
      displayId: applicationDisplayId(submissionId),
      category,
      status: "pending",
      minecraftUsername,
      discordUsername,
      submittedAt: now,
      decidedAt: null,
      denialReason: null,
    };
  });
}

export async function saveApplicationForm(input: ApplicationFormInput): Promise<ApplicationForm> {
  return withTransaction(async (client) => {
    const current = await client.query<FormRow>(
      "SELECT * FROM application_forms WHERE category = $1 AND archived_at IS NULL FOR UPDATE",
      [input.category],
    );
    const form = current.rows[0];
    if (!form) throw new ApplicationError("Application form not found.", 404);
    if (form.version !== input.version) {
      throw new ApplicationError("This form was edited by someone else. Refresh before saving.", 409);
    }
    const existingSections = await client.query<{ id: number }>(
      "SELECT id FROM application_sections WHERE form_id = $1",
      [form.id],
    );
    const existingSectionIds = new Set(existingSections.rows.map((row) => row.id));
    const incomingSectionIds = new Set(input.sections.map((section) => section.id).filter((id): id is number => id !== null));
    for (const id of existingSectionIds) {
      if (!incomingSectionIds.has(id)) {
        await client.query("DELETE FROM application_sections WHERE id = $1 AND form_id = $2", [id, form.id]);
      }
    }
    const now = new Date().toISOString();
    for (const [sectionIndex, section] of input.sections.entries()) {
      let sectionId = section.id;
      if (sectionId !== null && !existingSectionIds.has(sectionId)) {
        throw new ApplicationError("A section no longer belongs to this form.", 409);
      }
      if (sectionId === null) {
        const created = await client.query<{ id: number }>(
          `INSERT INTO application_sections (form_id, title, display_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $4) RETURNING id`,
          [form.id, section.title, sectionIndex, now],
        );
        sectionId = created.rows[0].id;
      } else {
        await client.query(
          "UPDATE application_sections SET title = $1, display_order = $2, updated_at = $3 WHERE id = $4 AND form_id = $5",
          [section.title, sectionIndex, now, sectionId, form.id],
        );
      }
      const existingQuestions = await client.query<{ id: number }>(
        "SELECT id FROM application_questions WHERE section_id = $1",
        [sectionId],
      );
      const existingQuestionIds = new Set(existingQuestions.rows.map((row) => row.id));
      const incomingQuestionIds = section.questions.map((question) => question.id).filter((id): id is number => id !== null);
      for (const id of existingQuestionIds) {
        if (!incomingQuestionIds.includes(id)) {
          await client.query("DELETE FROM application_questions WHERE id = $1 AND section_id = $2", [id, sectionId]);
        }
      }
      for (const [questionIndex, question] of section.questions.entries()) {
        if (question.id !== null && !existingQuestionIds.has(question.id)) {
          throw new ApplicationError("A question no longer belongs to this section.", 409);
        }
        if (question.id === null) {
          await client.query(
            `INSERT INTO application_questions (
               section_id, title, description, question_type, required, options,
               identity_key, display_order, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $9)`,
            [sectionId, question.title, question.description, question.type, question.required, JSON.stringify(question.options), question.identityKey ?? null, questionIndex, now],
          );
        } else {
          await client.query(
            `UPDATE application_questions
             SET title = $1, description = $2, question_type = $3, required = $4,
                 options = $5::jsonb, identity_key = $6, display_order = $7, updated_at = $8
             WHERE id = $9 AND section_id = $10`,
            [question.title, question.description, question.type, question.required, JSON.stringify(question.options), question.identityKey ?? null, questionIndex, now, question.id, sectionId],
          );
        }
      }
    }
    await client.query(
      `UPDATE application_forms
       SET title = $1, description = $2, submit_label = $3, closing_message = $4,
           enabled = $5, allow_reapply_after_denial = $6, reapply_wait_hours = $7,
           version = version + 1, updated_at = $8
       WHERE id = $9`,
      [input.title, input.description, input.submitLabel, input.closingMessage, input.enabled, input.allowReapplyAfterDenial, input.reapplyWaitHours, now, form.id],
    );
    return (await readForms(client, input.category))[0];
  });
}

export async function saveApplicationFormBody(body: unknown): Promise<ApplicationForm> {
  try {
    return await saveApplicationForm(parseApplicationFormInput(body));
  } catch (error) {
    if (error instanceof ApplicationInputError) throw new ApplicationError(error.message, 422, error.fields);
    throw error;
  }
}

function reviewText(value: unknown, label: string, maximum: number, minimum = 1): string {
  if (typeof value !== "string") throw new ApplicationError(`${label} is required.`);
  const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (cleaned.length < minimum || cleaned.length > maximum) {
    throw new ApplicationError(`${label} must be between ${minimum} and ${maximum} characters.`);
  }
  return cleaned;
}

export async function addApplicationNote(
  actor: SessionUser,
  submissionId: number,
  rawBody: unknown,
): Promise<ApplicationReviewNote[]> {
  const body = reviewText(rawBody, "Review note", 4000, 2);
  await withTransaction(async (client) => {
    const submission = await client.query<{ id: number }>(
      "SELECT id FROM application_submissions WHERE id = $1 FOR UPDATE",
      [submissionId],
    );
    if (!submission.rows[0]) throw new ApplicationError("Application not found.", 404);
    const now = new Date().toISOString();
    const actorUsername = actor.minecraftUsername ?? actor.username;
    await client.query(
      `INSERT INTO application_review_notes (
         submission_id, author_user_id, author_username, body, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $5)`,
      [submissionId, actor.id, actorUsername, body, now],
    );
    await client.query(
      `INSERT INTO application_history (
         submission_id, actor_user_id, actor_username, action, reason, created_at
       ) VALUES ($1, $2, $3, 'note_added', '', $4)`,
      [submissionId, actor.id, actorUsername, now],
    );
  });
  return readNotes(database, submissionId);
}

export async function decideApplication(
  actor: SessionUser,
  submissionId: number,
  status: unknown,
  rawReason: unknown,
): Promise<ApplicationSubmissionDetail> {
  if (status !== "accepted" && status !== "denied") throw new ApplicationError("Choose Accepted or Denied.");
  const reason = status === "denied" ? reviewText(rawReason, "Denial reason", 2000, 10) : "";
  await withTransaction(async (client) => {
    const current = await client.query<SubmissionRow>(
      "SELECT * FROM application_submissions WHERE id = $1 FOR UPDATE",
      [submissionId],
    );
    const submission = current.rows[0];
    if (!submission) throw new ApplicationError("Application not found.", 404);
    if (submission.status !== "pending") {
      throw new ApplicationError(`This application is already ${submission.status}.`, 409);
    }
    const now = new Date().toISOString();
    const actorUsername = actor.minecraftUsername ?? actor.username;
    await client.query(
      `UPDATE application_submissions
       SET status = $1, reviewed_by_user_id = $2, reviewed_by_username = $3,
           denial_reason = $4, decided_at = $5
       WHERE id = $6`,
      [status, actor.id, actorUsername, reason || null, now, submissionId],
    );
    await client.query(
      `INSERT INTO application_history (
         submission_id, actor_user_id, actor_username, action, from_status, to_status, reason, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [submissionId, actor.id, actorUsername, status === "accepted" ? "accepted" : "denied", submission.status, status, reason, now],
    );
  });
  const result = await getManagementSubmission(submissionId);
  if (!result) throw new ApplicationError("Application not found.", 404);
  return result;
}

export function parseSubmissionId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isUniqueSubmissionError(error: unknown): boolean {
  return isUniqueViolation(error);
}
