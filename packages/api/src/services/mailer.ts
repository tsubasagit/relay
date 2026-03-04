import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSmtpConfig } from "./settings.js";

let transporter: Transporter | null = null;
let lastConfigHash = "";

function configHash(): string {
  const cfg = getSmtpConfig();
  return `${cfg.smtpHost}:${cfg.smtpPort}:${cfg.smtpUser}:${cfg.smtpPass}`;
}

export function getTransporter(): Transporter {
  const hash = configHash();
  if (!transporter || hash !== lastConfigHash) {
    const cfg = getSmtpConfig();
    const port = parseInt(cfg.smtpPort);
    transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port,
      secure: port === 465,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
    });
    lastConfigHash = hash;
  }
  return transporter;
}

/** Reset cached transporter (call after settings change) */
export function resetTransporter(): void {
  transporter = null;
  lastConfigHash = "";
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const cfg = getSmtpConfig();
  const t = getTransporter();
  const fromAddress =
    options.from || `${cfg.fromName} <${cfg.fromAddress}>`;

  await t.sendMail({
    from: fromAddress,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

/** Verify SMTP connection without sending */
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const t = getTransporter();
    await t.verify();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
