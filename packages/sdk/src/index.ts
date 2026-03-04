export interface TalentMailConfig {
  baseUrl: string;
  apiKey: string;
}

export interface SendEmailOptions {
  to: string;
  templateId?: string;
  subject?: string;
  html?: string;
  text?: string;
  variables?: Record<string, string>;
  from?: string;
}

export interface SendEmailResult {
  id: string;
  status: string;
  to: string;
  subject: string;
}

export class TalentMailClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: TalentMailConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const res = await this.request<{ data: SendEmailResult }>("/emails/send", {
      method: "POST",
      body: JSON.stringify(options),
    });
    return res.data;
  }

  async health(): Promise<{ status: string; version: string }> {
    return this.request("/health");
  }
}
