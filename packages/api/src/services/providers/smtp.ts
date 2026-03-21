import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailProvider, SendOptions, SmtpConfig } from "./types.js";

export class SmtpProvider implements EmailProvider {
  private transporter: Transporter;

  constructor(config: SmtpConfig) {
    const port = config.port;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port,
      secure: config.secure ?? port === 465,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });
  }

  async send(options: SendOptions): Promise<void> {
    await this.transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      headers: options.headers,
    });
  }

  async verify(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
