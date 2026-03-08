import "dotenv/config";

export const config = {
  port: parseInt(process.env.API_PORT || "3456"),
  baseUrl: process.env.API_BASE_URL || "http://localhost:3456",
  databasePath: process.env.DATABASE_PATH || "./data/relay.db",

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3456/auth/google/callback",

  // Session
  sessionSecret: process.env.SESSION_SECRET || "dev-session-secret-change-in-production",

  // Encryption key for provider configs (32 bytes hex)
  encryptionKey: process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};
