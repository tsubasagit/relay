import { SESClient, SendEmailCommand, SendRawEmailCommand, GetSendQuotaCommand } from "@aws-sdk/client-ses";
import type { EmailProvider, SendOptions, SesConfig } from "./types.js";

export class SesProvider implements EmailProvider {
  private client: SESClient;

  constructor(config: SesConfig) {
    this.client = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async send(options: SendOptions): Promise<void> {
    if (options.headers && Object.keys(options.headers).length > 0) {
      // Use raw email to include custom headers
      const boundary = `----=_Part_${Date.now()}`;
      const headerLines = Object.entries(options.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n");

      let raw = `From: ${options.from}\r\n`;
      raw += `To: ${options.to}\r\n`;
      raw += `Subject: ${options.subject}\r\n`;
      raw += `MIME-Version: 1.0\r\n`;
      raw += `${headerLines}\r\n`;
      raw += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

      if (options.text) {
        raw += `--${boundary}\r\n`;
        raw += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
        raw += `${options.text}\r\n\r\n`;
      }

      raw += `--${boundary}\r\n`;
      raw += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      raw += `${options.html}\r\n\r\n`;
      raw += `--${boundary}--`;

      await this.client.send(
        new SendRawEmailCommand({
          RawMessage: { Data: Buffer.from(raw) },
        })
      );
      return;
    }

    const command = new SendEmailCommand({
      Source: options.from,
      Destination: {
        ToAddresses: [options.to],
      },
      Message: {
        Subject: { Data: options.subject },
        Body: {
          Html: { Data: options.html },
          ...(options.text ? { Text: { Data: options.text } } : {}),
        },
      },
    });

    await this.client.send(command);
  }

  async verify(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.send(new GetSendQuotaCommand({}));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
