import {
  isApplicationCategory,
  isApplicationQuestionType,
  type ApplicationAnswers,
  type ApplicationCategory,
  type ApplicationForm,
  type ApplicationQuestion,
  type ApplicationQuestionType,
  type ApplicationSection,
} from "./application-types";
import { isMinecraftUsername } from "./validation";

export interface ApplicationFormInput {
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

export class ApplicationInputError extends Error {
  fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApplicationInputError";
    this.fields = fields;
  }
}

function cleanText(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string") return "";
  const withoutControls = multiline
    ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    : value.replace(/[\u0000-\u001f\u007f]/g, " ");
  return withoutControls.trim();
}

function requiredText(value: unknown, max: number, label: string, multiline = false): string {
  const result = cleanText(value, max, multiline);
  if (!result) throw new ApplicationInputError(`${label} is required.`);
  if (result.length > max) throw new ApplicationInputError(`${label} must be ${max} characters or fewer.`);
  return result;
}

function optionalText(value: unknown, max: number, label: string, multiline = false): string {
  const result = cleanText(value, max, multiline);
  if (result.length > max) throw new ApplicationInputError(`${label} must be ${max} characters or fewer.`);
  return result;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new ApplicationInputError(`${label} must be enabled or disabled.`);
  return value;
}

function nullableId(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApplicationInputError(`${label} is invalid.`);
  return id;
}

function parseOptions(value: unknown, type: ApplicationQuestionType, label: string): string[] {
  if (type === "yes_no") return ["Yes", "No"];
  if (type === "short_text" || type === "long_text") return [];
  if (!Array.isArray(value)) return [];
  const options = value.map((option) => optionalText(option, 120, `${label} option`)).filter(Boolean);
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    throw new ApplicationInputError(`${label} options must be unique.`);
  }
  if (options.length > 20) throw new ApplicationInputError(`${label} can have at most 20 options.`);
  return options;
}

export function parseApplicationFormInput(value: unknown): ApplicationFormInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApplicationInputError("Invalid application form.");
  }
  const body = value as Record<string, unknown>;
  if (!isApplicationCategory(body.category)) throw new ApplicationInputError("Choose a valid application category.");
  if (!Array.isArray(body.sections) || body.sections.length === 0) {
    throw new ApplicationInputError("Add at least one form section.");
  }
  if (body.sections.length > 100) throw new ApplicationInputError("A form can have at most 100 sections.");

  const sectionIds = new Set<number>();
  const questionIds = new Set<number>();
  const identityKeys = new Set<"minecraft" | "discord">();
  let questionCount = 0;
  const sections: ApplicationSection[] = body.sections.map((rawSection, sectionIndex) => {
    if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) {
      throw new ApplicationInputError(`Section ${sectionIndex + 1} is invalid.`);
    }
    const section = rawSection as Record<string, unknown>;
    const id = nullableId(section.id, "Section ID");
    if (id !== null) {
      if (sectionIds.has(id)) throw new ApplicationInputError("Section IDs must be unique.");
      sectionIds.add(id);
    }
    const title = requiredText(section.title, 120, `Section ${sectionIndex + 1} title`);
    if (!Array.isArray(section.questions)) {
      throw new ApplicationInputError(`Add at least one question to “${title}”.`);
    }
    const questions: ApplicationQuestion[] = section.questions.map((rawQuestion, questionIndex) => {
      if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
        throw new ApplicationInputError(`Question ${questionIndex + 1} in “${title}” is invalid.`);
      }
      const question = rawQuestion as Record<string, unknown>;
      const questionId = nullableId(question.id, "Question ID");
      if (questionId !== null) {
        if (questionIds.has(questionId)) throw new ApplicationInputError("Question IDs must be unique.");
        questionIds.add(questionId);
      }
      if (!isApplicationQuestionType(question.type)) {
        throw new ApplicationInputError("Choose a valid question type.");
      }
      const questionTitle = requiredText(question.title, 240, "Question title");
      const identityKey = question.identityKey === "minecraft" || question.identityKey === "discord"
        ? question.identityKey
        : null;
      if (identityKey) {
        if (identityKeys.has(identityKey)) {
          throw new ApplicationInputError(`Only one question can provide the ${identityKey} username.`);
        }
        identityKeys.add(identityKey);
      }
      const options = parseOptions(question.options, question.type, questionTitle);
      if (["dropdown", "multiple_choice", "checkboxes"].includes(question.type)) {
        const minimum = question.type === "checkboxes" ? 1 : 2;
        if (options.length < minimum) {
          throw new ApplicationInputError(`Add at least ${minimum} answer option${minimum === 1 ? "" : "s"} to “${questionTitle}”.`);
        }
      }
      questionCount += 1;
      return {
        id: questionId,
        title: questionTitle,
        description: optionalText(question.description, 1200, "Question instructions", true),
        type: question.type,
        required: booleanValue(question.required, "Required setting"),
        options,
        identityKey,
      };
    });
    if (questions.length === 0) throw new ApplicationInputError(`Add at least one question to “${title}”.`);
    return { id, title, questions };
  });
  if (questionCount > 500) throw new ApplicationInputError("A form can have at most 500 questions.");

  const reapplyWaitHours = Number(body.reapplyWaitHours);
  if (!Number.isInteger(reapplyWaitHours) || reapplyWaitHours < 0 || reapplyWaitHours > 8760) {
    throw new ApplicationInputError("Waiting period must be between 0 and 8760 hours.");
  }
  const version = Number(body.version);
  if (!Number.isInteger(version) || version < 1) throw new ApplicationInputError("Invalid form version.");

  return {
    category: body.category,
    title: requiredText(body.title, 120, "Application title"),
    description: requiredText(body.description, 2000, "Application description", true),
    submitLabel: requiredText(body.submitLabel, 60, "Submission button text"),
    closingMessage: requiredText(body.closingMessage, 2000, "Closing message", true),
    enabled: booleanValue(body.enabled, "Applications enabled setting"),
    allowReapplyAfterDenial: booleanValue(body.allowReapplyAfterDenial, "Reapplication setting"),
    reapplyWaitHours,
    version,
    sections,
  };
}

export interface ValidatedApplicationAnswers {
  answers: ApplicationAnswers;
  fieldErrors: Record<string, string>;
  minecraftUsername: string;
  discordUsername: string;
}

export function validateApplicationAnswers(
  form: ApplicationForm,
  rawAnswers: unknown,
  accountMinecraftUsername: string | null,
): ValidatedApplicationAnswers {
  const source = rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)
    ? rawAnswers as Record<string, unknown>
    : {};
  const answers: ApplicationAnswers = {};
  const fieldErrors: Record<string, string> = {};
  let minecraftUsername = accountMinecraftUsername ?? "";
  let discordUsername = "";

  for (const section of form.sections) {
    for (const question of section.questions) {
      if (question.id === null) continue;
      const key = String(question.id);
      const raw = source[key];
      const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
      if (empty) {
        if (question.required) fieldErrors[key] = "This answer is required.";
        continue;
      }

      if (question.type === "checkboxes") {
        if (!Array.isArray(raw)) {
          fieldErrors[key] = "Choose at least one option.";
          continue;
        }
        const selected = [...new Set(raw.map((item) => cleanText(item, 120)).filter(Boolean))];
        if (selected.length === 0 || selected.some((item) => !question.options.includes(item))) {
          fieldErrors[key] = "Choose valid options for this question.";
          continue;
        }
        answers[key] = selected;
        continue;
      }

      if (["dropdown", "multiple_choice", "yes_no"].includes(question.type)) {
        const selected = cleanText(raw, 120);
        if (!question.options.includes(selected)) {
          fieldErrors[key] = "Choose one of the available options.";
          continue;
        }
        answers[key] = selected;
        continue;
      }

      if (typeof raw !== "string") {
        fieldErrors[key] = "Enter a valid answer.";
        continue;
      }
      const multiline = question.type === "long_text";
      const answer = cleanText(raw, multiline ? 5000 : 300, multiline);
      if (!answer) {
        if (question.required) fieldErrors[key] = "This answer is required.";
        continue;
      }
      if (answer.length > (multiline ? 5000 : 300)) {
        fieldErrors[key] = multiline ? "Answer must be 5000 characters or fewer." : "Answer must be 300 characters or fewer.";
        continue;
      }
      const normalizedTitle = question.title.toLowerCase();
      const identityKey = question.identityKey ?? (
        normalizedTitle.includes("minecraft username")
          ? "minecraft"
          : normalizedTitle.includes("discord username")
            ? "discord"
            : null
      );
      if (identityKey === "minecraft") {
        if (!isMinecraftUsername(answer)) {
          fieldErrors[key] = "Use a valid Minecraft username (3–16 letters, numbers or underscores).";
          continue;
        }
        minecraftUsername = answer;
      } else if (identityKey === "discord") {
        if (answer.length > 80) {
          fieldErrors[key] = "Discord username must be 80 characters or fewer.";
          continue;
        }
        discordUsername = answer;
      } else if (normalizedTitle.includes("links")) {
        const links = answer.split("\n").map((line) => line.trim()).filter(Boolean);
        const valid = links.every((link) => {
          try {
            const url = new URL(link);
            return url.protocol === "http:" || url.protocol === "https:";
          } catch {
            return false;
          }
        });
        if (!valid) {
          fieldErrors[key] = "Enter full HTTP or HTTPS links, one per line.";
          continue;
        }
      }
      answers[key] = answer;
    }
  }

  return { answers, fieldErrors, minecraftUsername, discordUsername };
}
