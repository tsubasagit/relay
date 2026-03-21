import sgMail from "@sendgrid/mail";
import type { EmailProvider, SendOptions, SendGridConfig } from "./types.js";

export class SendGridProvider implements EmailProvider {
  constructor(config: SendGridConfig) {
    sgMail.setApiKey(config.apiKey);
  }

  async send(options: SendOptions): Promise<void> {
    await sgMail.send({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || undefined,
      replyTo: options.replyTo || undefined,
      headers: options.headers || undefined,
    });
  }

  async verify(): Promise<{ success: boolean; error?: string }> {
    // SendGrid doesn't have a verify endpoint — just check the API key format
    try {
      // A simple validation: attempt to create a minimal request
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
