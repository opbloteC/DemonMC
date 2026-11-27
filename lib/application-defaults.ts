import type { PoolClient } from "pg";
import type {
  ApplicationCategory,
  ApplicationForm,
  ApplicationQuestion,
  ApplicationQuestionType,
  ApplicationSection,
} from "./application-types";

interface DefaultQuestion {
  title: string;
  type?: ApplicationQuestionType;
  description?: string;
  options?: string[];
  required?: boolean;
}

interface DefaultForm {
  category: ApplicationCategory;
  title: string;
  description: string;
  sections: Array<{ title: string; questions: DefaultQuestion[] }>;
}

const DEFAULT_FORMS: DefaultForm[] = [
  {
    category: "staff",
    title: "Staff Apply",
    description: "Tell us about yourself and how you would help the DemonMC community.",
    sections: [
      {
        title: "About you",
        questions: [
          { title: "Minecraft Username", type: "short_text" },
          { title: "Discord Username", type: "short_text" },
          { title: "Your Time Zone", type: "short_text" },
          { title: "How long have you been playing on DemonMC?", type: "short_text" },
          {
            title: "Have you been staff on another Minecraft server? Explain.",
            type: "long_text",
            description: "Include the server name, your role, and your experience. It is fine to answer No.",
          },
          { title: "How many hours can you be active each day?", type: "short_text" },
          { title: "What days are you usually available?", type: "short_text" },
        ],
      },
      {
        title: "Helping the community",
        questions: [
          { title: "Why do you want to become a Helper?", type: "long_text" },
          {
            title: "How would you handle a player repeatedly breaking server rules?",
            type: "long_text",
          },
          { title: "How would you handle two players arguing in chat?", type: "long_text" },
          {
            title: "What would you do if someone reported a hacker without clear evidence?",
            type: "long_text",
          },
          {
            title: "What would you do if another staff member abused their permissions?",
            type: "long_text",
          },
        ],
      },
      {
        title: "Why you",
        questions: [
          { title: "What makes you suitable for the Helper position?", type: "long_text" },
          { title: "Why should DemonMC management choose you?", type: "long_text" },
          {
            title: "Do you agree to follow all DemonMC staff rules?",
            type: "yes_no",
            options: ["Yes", "No"],
          },
        ],
      },
    ],
  },
  {
    category: "media",
    title: "Media Application",
    description: "Share your channels, experience, and ideas for creating DemonMC content.",
    sections: [
      {
        title: "Your channels",
        questions: [
          { title: "Minecraft Username", type: "short_text" },
          { title: "Discord Username", type: "short_text" },
          {
            title: "YouTube channel or social media links",
            type: "long_text",
            description: "Add one link per line. Only HTTP or HTTPS links are accepted.",
          },
          { title: "Which platforms do you create content on?", type: "short_text" },
          { title: "Subscriber or follower count", type: "short_text" },
          { title: "Average views per video or stream", type: "short_text" },
          { title: "How long have you been creating content?", type: "short_text" },
          { title: "What type of content do you create?", type: "long_text" },
        ],
      },
      {
        title: "Creating for DemonMC",
        questions: [
          { title: "Why do you want to join DemonMC Media?", type: "long_text" },
          { title: "What content would you create for DemonMC?", type: "long_text" },
          { title: "How frequently can you upload or stream?", type: "short_text" },
          {
            title: "Do you have previous server promotion experience?",
            type: "long_text",
            required: false,
          },
          { title: "Why should we select you?", type: "long_text" },
        ],
      },
    ],
  },
];

function toQuestion(question: DefaultQuestion): ApplicationQuestion {
  return {
    id: null,
    title: question.title,
    description: question.description ?? "",
    type: question.type ?? "long_text",
    required: question.required ?? true,
    options: question.options ?? [],
    identityKey: question.title.toLowerCase().includes("minecraft username")
      ? "minecraft"
      : question.title.toLowerCase().includes("discord username")
        ? "discord"
        : null,
  };
}

function toSections(form: DefaultForm): ApplicationSection[] {
  return form.sections.map((section) => ({
    id: null,
    title: section.title,
    questions: section.questions.map(toQuestion),
  }));
}

export async function seedDefaultApplications(client: PoolClient): Promise<void> {
  const now = new Date().toISOString();
  for (const form of DEFAULT_FORMS) {
    const existing = await client.query<{ id: number }>(
      "SELECT id FROM application_forms WHERE category = $1 AND archived_at IS NULL",
      [form.category],
    );
    if (existing.rows[0]) continue;

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO application_forms (
         category, title, description, submit_label, closing_message, enabled,
         allow_reapply_after_denial, reapply_wait_hours, version, created_at, updated_at
       ) VALUES ($1, $2, $3, 'SUBMIT APPLICATION', $4, TRUE, TRUE, 24, 1, $5, $5)
       RETURNING id`,
      [
        form.category,
        form.title,
        form.description,
        "Thank you for applying. Management will review your application and update its status here.",
        now,
      ],
    );
    const formId = inserted.rows[0].id;
    for (const [sectionIndex, section] of toSections(form).entries()) {
      const sectionRow = await client.query<{ id: number }>(
        `INSERT INTO application_sections (form_id, title, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4) RETURNING id`,
        [formId, section.title, sectionIndex, now],
      );
      for (const [questionIndex, question] of section.questions.entries()) {
        await client.query(
          `INSERT INTO application_questions (
             section_id, title, description, question_type, required, options,
             identity_key, display_order, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $9)`,
          [
            sectionRow.rows[0].id,
            question.title,
            question.description,
            question.type,
            question.required,
            JSON.stringify(question.options),
            question.identityKey,
            questionIndex,
            now,
          ],
        );
      }
    }
  }
}

export function defaultApplicationForm(category: ApplicationCategory): ApplicationForm {
  const form = DEFAULT_FORMS.find((item) => item.category === category)!;
  return {
    id: 0,
    category,
    title: form.title,
    description: form.description,
    submitLabel: "SUBMIT APPLICATION",
    closingMessage: "Thank you for applying. Management will review your application and update its status here.",
    enabled: true,
    allowReapplyAfterDenial: true,
    reapplyWaitHours: 24,
    version: 1,
    sections: toSections(form),
  };
}
