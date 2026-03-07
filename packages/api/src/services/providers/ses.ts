import { SESClient, SendEmailCommand, GetSendQuotaCommand } from "@aws-sdk/client-ses";
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
