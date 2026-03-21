export interface SendOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface EmailProvider {
  send(options: SendOptions): Promise<void>;
  verify(): Promise<{ success: boolean; error?: string }>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure?: boolean;
}

export interface SendGridConfig {
  apiKey: string;
}

export interface SesConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface GmailOAuthConfig {
  email: string;
  userId: string;
}

export type ProviderConfig = SmtpConfig | SendGridConfig | SesConfig | GmailOAuthConfig;
export type ProviderType = "smtp" | "sendgrid" | "ses" | "gmail-oauth";
