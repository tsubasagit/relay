import "dotenv/config";

// Static config (not changeable via UI)
export const config = {
  port: parseInt(process.env.API_PORT || "3456"),
  baseUrl: process.env.API_BASE_URL || "http://localhost:3456",
  databasePath: process.env.DATABASE_PATH || "./data/talentmail.db",
};

// Default SMTP/mail config (overridable via settings table)
export const defaultSmtpConfig = {
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: process.env.SMTP_PORT || "587",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  fromAddress: process.env.FROM_ADDRESS || "info@apptalenthub.co.jp",
  fromName: process.env.FROM_NAME || "AppTalentHub",
};

export interface SmtpConfig {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
}
