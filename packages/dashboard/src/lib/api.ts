const API_BASE = "/api";

let apiKey = localStorage.getItem("talentmail_api_key") || "";

export function setApiKey(key: string) {
  apiKey = key;
  localStorage.setItem("talentmail_api_key", key);
}

export function getApiKey(): string {
  return apiKey;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Templates
export const templates = {
  list: () => request<{ data: Template[] }>("/templates"),
  get: (id: string) => request<{ data: Template }>(`/templates/${id}`),
  create: (data: CreateTemplate) =>
    request<{ data: Template }>("/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CreateTemplate>) =>
    request<{ data: Template }>(`/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/templates/${id}`, { method: "DELETE" }),
  test: (id: string, to: string, variables?: Record<string, string>) =>
    request<{ message: string; to: string; subject: string }>(
      `/templates/${id}/test`,
      {
        method: "POST",
        body: JSON.stringify({ to, variables }),
      }
    ),
};

// Emails
export const emails = {
  send: (data: SendEmail) =>
    request<{ data: { id: string; status: string; to: string; subject: string } }>(
      "/emails/send",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),
};

// Logs
export const logs = {
  list: (params?: LogParams) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const qs = searchParams.toString();
    return request<{ data: EmailLog[]; total: number }>(`/logs${qs ? `?${qs}` : ""}`);
  },
  stats: () => request<{ data: Stats }>("/logs/stats"),
};

// Settings
export const settingsApi = {
  getSmtp: () => request<{ data: SmtpSettings }>("/settings/smtp"),
  updateSmtp: (data: Partial<SmtpSettingsInput>) =>
    request<{ data: SmtpSettings; message: string }>("/settings/smtp", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testConnection: () =>
    request<{ message: string }>("/settings/smtp/test-connection", {
      method: "POST",
    }),
  testSend: (to: string) =>
    request<{ message: string }>("/settings/smtp/test-send", {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
};

// API Keys
export const keys = {
  list: () => request<{ data: ApiKeyInfo[] }>("/keys"),
  create: (name: string, scopes?: string[]) =>
    request<{ data: ApiKeyInfo & { key: string }; message: string }>("/keys", {
      method: "POST",
      body: JSON.stringify({ name, scopes }),
    }),
  revoke: (id: string) =>
    request<{ message: string }>(`/keys/${id}`, { method: "DELETE" }),
};

// Types
export interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: string[];
  category: "transactional" | "marketing";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplate {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  category?: "transactional" | "marketing";
}

export interface SendEmail {
  to: string;
  templateId?: string;
  subject?: string;
  html?: string;
  text?: string;
  variables?: Record<string, string>;
  from?: string;
}

export interface EmailLog {
  id: string;
  templateId: string | null;
  contactId: string | null;
  audienceId: string | null;
  fromAddress: string;
  toAddress: string;
  subject: string;
  status: "queued" | "sent" | "bounced" | "failed";
  openedAt: string | null;
  clickedAt: string | null;
  clickedUrl: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface LogParams {
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface Stats {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface SmtpSettings {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
  isConfigured: boolean;
}

export interface SmtpSettingsInput {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
}
