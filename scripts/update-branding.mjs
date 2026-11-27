import fs from "node:fs";
import path from "node:path";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const values = {
  "site.headline": "YOUR ADVENTURE. YOUR LEGACY. YOUR DEMONMC.",
  "site.subtitle":
    "Enter a world of competition, survival, powerful alliances, and unforgettable adventures. Your journey starts here.",
  "site.ip": "demonmc.mcpe.network",
  "site.discord": "https://discord.gg/mFYwCJBTuA",
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

try {
  for (const [key, value] of Object.entries(values)) {
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }
  console.log("Site branding settings updated (headline, subtitle, IP, Discord).");
} catch (error) {
  console.error("Failed to update settings:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
