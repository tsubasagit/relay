import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../.env") });

const isProduction = process.env.NODE_ENV === "production";

function requireEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return fallback;
}

export const config = {
  port: parseInt(process.env.API_PORT || "3456"),
  baseUrl: process.env.API_BASE_URL || "http://localhost:3456",
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://localhost:5432/relay"),

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3456/auth/google/callback",

  // Session
  sessionSecret: requireEnv("SESSION_SECRET", "dev-session-secret-change-in-production"),

  // Encryption key for provider configs (32 bytes hex)
  encryptionKey: requireEnv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),

  // Dashboard URL
  dashboardUrl: process.env.DASHBOARD_URL || "http://localhost:5174",

  // Default SMTP provider (Gmail)
  defaultSmtpHost: process.env.RELAY_DEFAULT_SMTP_HOST || "smtp.gmail.com",
  defaultSmtpPort: parseInt(process.env.RELAY_DEFAULT_SMTP_PORT || "587"),
  defaultSmtpUser: process.env.RELAY_DEFAULT_SMTP_USER || "",
  defaultSmtpPass: process.env.RELAY_DEFAULT_SMTP_PASS || "",
  defaultFrom: process.env.RELAY_DEFAULT_FROM || "",
};
