import { cache } from "react";
import { unstable_cache } from "next/cache";
import { brandTokens, getBranding } from "./branding";
import { SITE_DATA_TAG } from "./cache";
import { DEFAULT_SETTINGS, query } from "./db";
import { getSettings } from "./settings";
import type { SiteSettings } from "./types";

export type SettingsField = keyof SiteSettings;

export interface ContentField {
  key: string;
  label: string;
  defaultValue: string;
  max: number;
  multiline?: boolean;
  settingsField?: SettingsField;
}

export interface ContentSection {
  id: string;
  label: string;
  fields: ContentField[];
}

export interface ContentPageDef {
  id: string;
  label: string;
  description: string;
  sections: ContentSection[];
}

function field(
  key: string,
  label: string,
  defaultValue: string,
  max: number,
  multiline = false,
): ContentField {
  return { key, label, defaultValue, max, multiline };
}

export const CONTENT_PAGES: ContentPageDef[] = [
  {
    id: "navigation",
    label: "Navigation",
    description: "Header links and the profile buttons shown on every public page.",
    sections: [
      {
        id: "header",
        label: "Header",
        fields: [
          field("nav.home", "Home link", "Home", 24),
          field("nav.rules", "Rules link", "Rules", 24),
          field("nav.store", "Store link", "Store", 24),
          field("nav.announcements", "Announcements link", "Announcements", 24),
          field("nav.discord", "Discord link", "Discord", 24),
          field("nav.staff", "Staff Panel link", "Staff Panel", 24),
          field("nav.login", "Login button", "Login", 24),
          field("nav.register", "Register button", "Register", 24),
          field("nav.account", "Profile button", "Profile", 24),
        ],
      },
    ],
  },
  {
    id: "home",
    label: "Homepage",
    description: "The hero, getting-started steps, feature cards, news and community panel.",
    sections: [
      {
        id: "hero",
        label: "Hero",
        fields: [
          field(
            "home.hero.kicker",
            "Kicker under the logo",
            "Minecraft Network",
            60,
          ),
          field(
            "site.subtitle",
            "Hero subtitle",
            DEFAULT_SETTINGS["site.subtitle"],
            140,
            true,
          ),
          field("home.hero.primaryCta", "Primary button", "Join Discord", 40),
        ],
      },
      {
        id: "steps",
        label: "Getting started",
        fields: [
          field("home.steps.eyebrow", "Eyebrow", "Getting started", 60),
          field("home.steps.title", "Heading", "Join {brandHero}", 80),
          field(
            "home.steps.description",
            "Description",
            "Copy the IP, add the server in Minecraft, and create your player account. Three steps and you are in.",
            240,
            true,
          ),
          field("home.steps.one.title", "Step 1 title", "Copy the server IP", 80),
          field(
            "home.steps.one.copy",
            "Step 1 text",
            "Use the copy button above — the address is {ip}.",
            200,
            true,
          ),
          field("home.steps.two.title", "Step 2 title", "Add the server", 80),
          field(
            "home.steps.two.copy",
            "Step 2 text",
            "Open Minecraft Java Edition → Multiplayer → Add Server and paste the IP.",
            200,
            true,
          ),
          field("home.steps.three.title", "Step 3 title", "Create your account", 80),
          field(
            "home.steps.three.copy",
            "Step 3 text",
            "Register with your Minecraft username to appear on the roster and unlock your dashboard.",
            200,
            true,
          ),
          field("home.steps.ipPrompt", "Copy-IP prompt", "Ready to play? The IP is", 80),
        ],
      },
      {
        id: "features",
        label: "Features",
        fields: [
          field("home.features.eyebrow", "Eyebrow", "Game modes & features", 60),
          field("home.features.title", "Heading", "What awaits you", 80),
          field(
            "home.features.description",
            "Description",
            "Competitive Minecraft with a community behind it. Everything {brand}, in one place.",
            240,
            true,
          ),
          field("home.features.one.tag", "Feature 1 tag", "Game mode", 40),
          field("home.features.one.title", "Feature 1 title", "Seasonal Lifesteal", 80),
          field(
            "home.features.one.copy",
            "Feature 1 text",
            "New seasons, fresh starts and a competitive pace that never lets up. Every fight matters.",
            200,
            true,
          ),
          field("home.features.two.tag", "Feature 2 tag", "Alliances", 40),
          field("home.features.two.title", "Feature 2 title", "Build your team", 80),
          field(
            "home.features.two.copy",
            "Feature 2 text",
            "Forge powerful alliances, protect your base and rise through the ranks with your crew.",
            200,
            true,
          ),
          field("home.features.three.tag", "Feature 3 tag", "Community", 40),
          field("home.features.three.title", "Feature 3 title", "Staff you can trust", 80),
          field(
            "home.features.three.copy",
            "Feature 3 text",
            "An active team keeps the network fair, friendly and focused on the players.",
            200,
            true,
          ),
          field("home.features.four.tag", "Feature 4 tag", "Live", 40),
          field("home.features.four.title", "Feature 4 title", "Always in sync", 80),
          field(
            "home.features.four.copy",
            "Feature 4 text",
            "Server status, the real roster and announcements are pulled straight from the network.",
            200,
            true,
          ),
        ],
      },
      {
        id: "news",
        label: "Latest announcements",
        fields: [
          field("home.news.eyebrow", "Eyebrow", "News", 60),
          field("home.news.title", "Heading", "Latest announcements", 80),
          field(
            "home.news.description",
            "Description",
            "Updates, events and news straight from the network.",
            200,
            true,
          ),
          field("home.news.all", "All announcements link", "All announcements", 40),
          field("home.news.empty.title", "Empty state heading", "No announcements yet", 80),
          field(
            "home.news.empty.description",
            "Empty state text",
            "Updates from {brand} will appear here as soon as they are published.",
            200,
            true,
          ),
        ],
      },
      {
        id: "community",
        label: "Community panel",
        fields: [
          field("home.community.eyebrow", "Eyebrow", "Community", 60),
          field("home.community.title", "Heading", "More than a server", 80),
          field(
            "home.community.description",
            "Description",
            "Announcements, events, teammates and everything in between — the {brand} community lives in Discord. Pull up a chair.",
            300,
            true,
          ),
          field("home.community.cta", "Primary button", "Join the Discord", 40),
          field("home.community.cardTitle", "Card title", "{brand} Discord", 80),
          field(
            "home.community.cardNote",
            "Card note",
            "Open invite — jump in and say hello.",
            160,
            true,
          ),
          field("home.community.cardCta", "Card button", "Accept invite", 40),
        ],
      },
    ],
  },
  {
    id: "store",
    label: "Store page",
    description: "Store hero, rank notes and the closing Discord panel.",
    sections: [
      {
        id: "hero",
        label: "Hero",
        fields: [
          field("store.eyebrow", "Eyebrow", "RANK STORE", 60),
          field(
            "store.description",
            "Description",
            "Choose your rank. Unlock your status. Join the {brand} community.",
            240,
            true,
          ),
        ],
      },
      {
        id: "closing",
        label: "Closing panel",
        fields: [
          field(
            "store.closing.title",
            "Heading",
            "CHOOSE YOUR RANK. JOIN THE COMMUNITY.",
            100,
          ),
          field(
            "store.closing.description",
            "Description",
            "Every rank is delivered manually by {brand} staff. Join our Discord to complete a purchase or to claim the free Power Rank — there is no checkout on this website.",
            300,
            true,
          ),
          field("store.closing.cta", "Discord button", "JOIN OUR DISCORD", 40),
        ],
      },
    ],
  },
  {
    id: "rules",
    label: "Rules page",
    description: "Rules hero and the closing Discord panel.",
    sections: [
      {
        id: "hero",
        label: "Hero",
        fields: [
          field("rules.eyebrow", "Eyebrow", "{brandUpper} COMMUNITY", 60),
          field(
            "rules.description",
            "Description",
            "Play fair. Respect everyone. Make every adventure count.",
            240,
            true,
          ),
        ],
      },
      {
        id: "closing",
        label: "Closing panel",
        fields: [
          field("rules.closing.title", "Heading", "PLAY FAIR. RESPECT OTHERS. ENJOY THE SERVER.", 100),
          field("rules.closing.cta", "Discord button", "JOIN OUR DISCORD", 40),
        ],
      },
    ],
  },
  {
    id: "announcements",
    label: "Announcements page",
    description: "News header, empty state and the card link label.",
    sections: [
      {
        id: "header",
        label: "Header",
        fields: [
          field("announcements.eyebrow", "Eyebrow", "News", 60),
          field("announcements.titlePre", "Heading before highlight", "Announce", 40),
          field("announcements.titleHighlight", "Highlighted word", "ments", 40),
          field(
            "announcements.description",
            "Description",
            "Everything the network wants you to know — updates, events and important notices.",
            260,
            true,
          ),
        ],
      },
      {
        id: "empty",
        label: "Empty state",
        fields: [
          field("announcements.empty.title", "Heading", "No announcements yet", 80),
          field(
            "announcements.empty.description",
            "Text",
            "When {brand} publishes news, it will appear here and on the homepage.",
            200,
            true,
          ),
          field(
            "announcements.card.link",
            "Card link",
            "Read on the announcements page",
            80,
          ),
        ],
      },
    ],
  },
  {
    id: "login",
    label: "Login page",
    description: "Headings, form labels and notices on the sign-in page.",
    sections: [
      {
        id: "header",
        label: "Header",
        fields: [
          field("login.eyebrow", "Eyebrow", "{brandLogin} Network", 60),
          field("login.heading", "Heading", "Welcome back", 80),
          field(
            "login.subheading",
            "Subheading",
            "Sign in with your Minecraft username and the email address registered to that account.",
            200,
            true,
          ),
        ],
      },
      {
        id: "card",
        label: "Card",
        fields: [
          field("login.cardTitle", "Card title", "Account access", 60),
          field("login.cardDescription", "Card description", "Sign in to your {brandLogin} account.", 160),
          field("login.usernameLabel", "Username label", "Email or username", 40),
          field(
            "login.usernamePlaceholder",
            "Username placeholder",
            "Email or Minecraft username",
            60,
          ),
          field("login.passwordLabel", "Password label", "Password", 40),
          field("login.forgot", "Forgot password link", "Forgot password?", 40),
          field("login.submit", "Submit button", "Sign in", 40),
          field("login.pending", "Submit button while signing in", "Signing in…", 40),
          field("login.newHere", "New-account text", "New to {brandLogin}?", 80),
          field("login.create", "Create-account link", "Create an account", 40),
          field("login.community", "Community Discord link", "Community Discord", 40),
          field("login.footer", "Footer line", "{brandFooter} · Enter the world", 80),
        ],
      },
      {
        id: "notices",
        label: "Notices",
        fields: [
          field(
            "login.registered",
            "After registration",
            "Account created. Sign in with your email and password.",
            200,
            true,
          ),
          field(
            "login.reset",
            "After a password reset",
            "Your password has been reset successfully. Please log in with your new password.",
            200,
            true,
          ),
          field(
            "login.error",
            "Sign-in error",
            "Unable to sign in. Please try again.",
            200,
          ),
          field(
            "login.networkError",
            "Network error",
            "Network error. Check your connection and try again.",
            200,
          ),
        ],
      },
    ],
  },
  {
    id: "register",
    label: "Registration page",
    description: "Headings, form labels and notes on the account registration page.",
    sections: [
      {
        id: "header",
        label: "Header",
        fields: [
          field("register.eyebrow", "Eyebrow", "{brandLogin} Network", 60),
          field("register.heading", "Heading", "Create your account", 80),
          field(
            "register.subheading",
            "Subheading",
            "Join the network. Your adventure starts here.",
            200,
            true,
          ),
        ],
      },
      {
        id: "card",
        label: "Card",
        fields: [
          field("register.cardTitle", "Card title", "Player registration", 60),
          field(
            "register.cardDescription",
            "Card description",
            "One account for the website and the server.",
            160,
          ),
          field("register.usernameLabel", "Minecraft username label", "Minecraft username", 40),
          field("register.emailLabel", "Email label", "Email address", 40),
          field("register.passwordLabel", "Password label", "Password", 40),
          field("register.confirmLabel", "Confirm password label", "Confirm password", 40),
          field("register.submit", "Submit button", "Create account", 40),
          field("register.pending", "Submit button while creating", "Creating account…", 40),
          field("register.already", "Existing-account text", "Already have an account?", 80),
          field("register.login", "Login link", "Login", 40),
          field(
            "register.note",
            "Rank note",
            "New accounts start at the Member rank. Staff roles and cosmetic ranks are assigned by the team.",
            240,
            true,
          ),
          field("register.footer", "Footer line", "{brandFooter} · Enter the world", 80),
        ],
      },
    ],
  },
  {
    id: "password",
    label: "Password pages",
    description: "Headings on the forgot-password and reset-password screens.",
    sections: [
      {
        id: "forgot",
        label: "Forgot password",
        fields: [
          field("forgot.heading", "Heading", "Forgot your password?", 80),
          field(
            "forgot.subheading",
            "Subheading",
            "No problem — we'll email you a secure 6-digit verification code.",
            240,
            true,
          ),
          field("forgot.cardTitle", "Card title", "Account recovery", 60),
          field(
            "forgot.cardDescription",
            "Card description",
            "We'll send a single-use verification code to your inbox.",
            160,
          ),
        ],
      },
      {
        id: "reset",
        label: "Reset password",
        fields: [
          field("reset.heading", "Heading", "Choose a new password", 80),
          field(
            "reset.subheading",
            "Subheading",
            "Your verification code is confirmed. Choose a new password to finish.",
            240,
            true,
          ),
          field("reset.cardTitle", "Card title", "Reset your password", 60),
          field(
            "reset.cardDescription",
            "Card description",
            "Verification codes expire 10 minutes after they are sent.",
            160,
          ),
        ],
      },
      {
        id: "shared",
        label: "Shared elements",
        fields: [
          field("password.backToLogin", "Back-to-login link", "Back to login", 40),
          field("password.community", "Community Discord link", "Community Discord", 40),
          field("password.footer", "Footer line", "{brandFooter} · Enter the world", 80),
        ],
      },
    ],
  },
  {
    id: "dashboard",
    label: "Player dashboard",
    description: "Account overview shown to every signed-in player.",
    sections: [
      {
        id: "header",
        label: "Header",
        fields: [
          field("dashboard.heading.eyebrow", "Eyebrow", "Account", 60),
          field("dashboard.heading.title", "Heading", "Dashboard", 80),
          field("dashboard.heading.signedIn", "Signed-in line", "Signed in as", 60),
        ],
      },
      {
        id: "account",
        label: "Account information",
        fields: [
          field("dashboard.account.title", "Card title", "Account information", 80),
          field(
            "dashboard.account.description",
            "Card description",
            "Details stored on your {brand} account.",
            200,
          ),
          field("dashboard.account.minecraft", "Minecraft username label", "Minecraft username", 40),
          field("dashboard.account.email", "Email label", "Email", 40),
          field("dashboard.account.role", "Role label", "Role", 40),
          field("dashboard.account.since", "Member since label", "Member since", 40),
          field("dashboard.session.title", "Session card title", "Session", 40),
          field("dashboard.shortcuts.title", "Shortcuts card title", "Shortcuts", 40),
          field(
            "dashboard.session.note",
            "Session note",
            "You are signed in with a secure HttpOnly session cookie. It expires after seven days or when you sign out.",
            300,
            true,
          ),
        ],
      },
    ],
  },
  {
    id: "profile",
    label: "Profile page",
    description: "Your account profile page headings and labels.",
    sections: [
      {
        id: "header",
        label: "Header",
        fields: [
          field("profile.eyebrow", "Eyebrow", "Account", 60),
          field("profile.title", "Heading", "Your profile", 80),
          field("profile.account.title", "Account card title", "Account", 80),
          field("profile.shortcuts.title", "Shortcuts heading", "Account shortcuts", 80),
          field("profile.joined", "Joined label", "Joined", 40),
          field("profile.role", "Role label", "Role", 40),
          field("profile.email", "Email label", "Email", 40),
          field(
            "profile.privacy",
            "Privacy note",
            "Your email is private. Only your Minecraft username, skin and rank are shown to staff.",
            300,
            true,
          ),
        ],
      },
    ],
  },
  {
    id: "footer",
    label: "Footer",
    description: "Footer tagline, column headings and legal line.",
    sections: [
      {
        id: "footer",
        label: "Footer",
        fields: [
          field(
            "footer.tagline",
            "Tagline",
            "A Minecraft network built for players who want more. Enter the world. Build your legacy.",
            300,
            true,
          ),
          field("footer.joinDiscord", "Discord button", "Join our Discord", 40),
          field("footer.navigate", "Navigate heading", "Navigate", 40),
          field("footer.connect", "Connect heading", "Connect", 40),
          field("footer.serverIp", "Server IP label", "Server IP", 40),
          field("footer.discord", "Discord link", "Discord", 40),
          field(
            "footer.copyright",
            "Copyright line",
            "© {year} {brandFooter}. All rights reserved.",
            160,
          ),
          field(
            "footer.owner",
            "Owner line",
            "Owned & operated by opblote · Not affiliated with Mojang or Microsoft.",
            200,
            true,
          ),
        ],
      },
    ],
  },
  {
    id: "basics",
    label: "Site basics",
    description: "Headline, subtitle, server address and Discord invite stored in site settings.",
    sections: [
      {
        id: "basics",
        label: "Site basics",
        fields: [
          {
            ...field("site.headline", "Headline", DEFAULT_SETTINGS["site.headline"], 90),
            settingsField: "headline",
          },
          {
            ...field("site.subtitle", "Subtitle", DEFAULT_SETTINGS["site.subtitle"], 140, true),
            settingsField: "subtitle",
          },
          {
            ...field("site.ip", "Server address", DEFAULT_SETTINGS["site.ip"], 253),
            settingsField: "ip",
          },
          {
            ...field("site.discord", "Discord invite", DEFAULT_SETTINGS["site.discord"], 500),
            settingsField: "discord",
          },
        ],
      },
    ],
  },
];

export const CONTENT_FIELDS: Map<string, ContentField> = new Map(
  CONTENT_PAGES.flatMap((page) => page.sections.flatMap((section) => section.fields)).map(
    (item) => [item.key, item],
  ),
);

export const DEFAULT_CONTENT: Record<string, string> = Object.fromEntries(
  [...CONTENT_FIELDS.values()].map((item) => [item.key, item.defaultValue]),
);

export type ContentMap = Record<string, string>;

/** Merge stored overrides on top of the built-in defaults. */
async function readContent(): Promise<ContentMap> {
  const [rows, settings, branding] = await Promise.all([
    query<{ key: string; value: string }>("SELECT key, value FROM site_content"),
    getSettings(),
    getBranding(),
  ]);

  const map: ContentMap = { ...DEFAULT_CONTENT };
  for (const row of rows.rows) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_CONTENT, row.key)) {
      map[row.key] = row.value;
    }
  }

  for (const item of CONTENT_FIELDS.values()) {
    if (item.settingsField) {
      map[item.key] = settings[item.settingsField];
    }
  }

  const tokens = brandTokens(branding);
  for (const key of Object.keys(map)) {
    map[key] = fillCopy(map[key], tokens);
  }

  // Read-only brand values for shared components. These are not editor fields.
  map["brand.name"] = branding.name;
  map["brand.navbar"] = branding.navbar;
  map["brand.hero"] = branding.hero;
  map["brand.login"] = branding.login;
  map["brand.footer"] = branding.footer;
  map["brand.siteTitle"] = branding.siteTitle;
  map["brand.metaDescription"] = branding.metaDescription;

  return map;
}

const contentCache = unstable_cache(readContent, ["site-content"], {
  tags: [SITE_DATA_TAG],
  revalidate: 300,
});

export const getContent = cache(contentCache);

/** Replace {token} placeholders with runtime values. */
export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token) ? String(values[token]) : match,
  );
}

export type ContentValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function normalizeAndValidateContent(key: string, raw: unknown): ContentValidation {
  const item = CONTENT_FIELDS.get(key);
  if (!item) return { ok: false, error: "Unknown content field." };
  if (typeof raw !== "string") return { ok: false, error: "Text values must be strings." };

  const value = raw.replace(/\r\n?/g, "\n").trim();
  if (value.length === 0) return { ok: false, error: `${item.label} cannot be empty.` };
  if (value.length > item.max) {
    return { ok: false, error: `${item.label} must be ${item.max} characters or fewer.` };
  }
  if (!item.settingsField && value.length < 1) {
    return { ok: false, error: `${item.label} cannot be empty.` };
  }

  return { ok: true, value };
}

export function contentPagesForEditor(content: ContentMap) {
  return CONTENT_PAGES.map((page) => ({
    id: page.id,
    label: page.label,
    description: page.description,
    sections: page.sections.map((section) => ({
      id: section.id,
      label: section.label,
      fields: section.fields.map((item) => ({
        key: item.key,
        label: item.label,
        max: item.max,
        multiline: Boolean(item.multiline),
        settingsField: item.settingsField ?? null,
        value: content[item.key] ?? item.defaultValue,
        defaultValue: item.defaultValue,
      })),
    })),
  }));
}
