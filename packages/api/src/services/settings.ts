import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";
import { defaultSmtpConfig, type SmtpConfig } from "../config.js";

const SMTP_KEYS: (keyof SmtpConfig)[] = [
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "fromAddress",
  "fromName",
];

export function getSmtpConfig(): SmtpConfig {
  const result = { ...defaultSmtpConfig };

  for (const key of SMTP_KEYS) {
    const [row] = db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
      .all();
    if (row) {
      result[key] = row.value;
    }
  }

  return result;
}

export function setSmtpConfig(updates: Partial<SmtpConfig>): SmtpConfig {
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(updates)) {
    if (!SMTP_KEYS.includes(key as keyof SmtpConfig)) continue;
    if (value === undefined || value === null) continue;

    const [existing] = db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
      .all();

    if (existing) {
      db.update(settings)
        .set({ value: String(value), updatedAt: now })
        .where(eq(settings.key, key))
        .run();
    } else {
      db.insert(settings)
        .values({ key, value: String(value), updatedAt: now })
        .run();
    }
  }

  return getSmtpConfig();
}

/** Returns config with password masked for API responses */
export function getSmtpConfigMasked(): SmtpConfig & { isConfigured: boolean } {
  const cfg = getSmtpConfig();
  return {
    ...cfg,
    smtpPass: cfg.smtpPass ? "••••••••" : "",
    isConfigured: !!(cfg.smtpUser && cfg.smtpPass),
  };
}
