const API_BASE = "/api";

let currentOrgId = localStorage.getItem("relay_org_id") || "";

export function setOrgId(orgId: string) {
  currentOrgId = orgId;
  localStorage.setItem("relay_org_id", orgId);
  // Org切替時にキャッシュを全クリア
  requestCache.clear();
}

export function getOrgId(): string {
  return currentOrgId;
}

// ─── GET request cache (ページ遷移で同じデータを再取得しない) ───
const CACHE_TTL = 30_000; // 30秒
const requestCache = new Map<string, { data: unknown; expiry: number }>();

function getCacheKey(path: string): string {
  return `${currentOrgId}:${path}`;
}

/** POST/PUT/DELETE 後にキャッシュを無効化 */
export function invalidateCache(pathPrefix?: string) {
  if (!pathPrefix) {
    requestCache.clear();
    return;
  }
  const prefix = `${currentOrgId}:${pathPrefix}`;
  for (const key of requestCache.keys()) {
    if (key.startsWith(prefix)) requestCache.delete(key);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const cacheKey = getCacheKey(path);

  // GET はキャッシュを確認
  if (isGet) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (currentOrgId) {
    headers["X-Org-Id"] = currentOrgId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    // Redirect to login
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Not authenticated");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const data = await res.json() as T;

  if (isGet) {
    // GET レスポンスをキャッシュ
    requestCache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
  } else {
    // 変更操作時はキャッシュ全クリア（次のGETで最新データを取得）
    requestCache.clear();
  }

  return data;
}

// Auth-only requests (no X-Org-Id needed)
async function authRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Auth ───
export const auth = {
  me: () => authRequest<{ data: User }>("/auth/me"),
  logout: () => authRequest<{ message: string }>("/auth/logout", { method: "POST" }),
};

// ─── Organizations ───
export const orgs = {
  list: () => authRequest<{ data: OrgWithRole[] }>("/api/orgs"),
  create: (data: { name: string; slug: string }) =>
    authRequest<{ data: OrgWithRole }>("/api/orgs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  get: (id: string) => authRequest<{ data: OrgWithRole }>(`/api/orgs/${id}`),
  update: (id: string, data: { name: string }) =>
    authRequest<{ data: Organization }>(`/api/orgs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  members: (id: string) => authRequest<{ data: OrgMember[] }>(`/api/orgs/${id}/members`),
  invite: (id: string, email: string, role: string = "member") =>
    authRequest<{ data: { token: string; email: string; expiresAt: string } }>(
      `/api/orgs/${id}/invite`,
      { method: "POST", body: JSON.stringify({ email, role }) }
    ),
  removeMember: (orgId: string, memberId: string) =>
    authRequest<{ message: string }>(`/api/orgs/${orgId}/members/${memberId}`, {
      method: "DELETE",
    }),
};

// ─── Invitations ───
export const invitations = {
  get: (token: string) => authRequest<{ data: InvitationInfo }>(`/api/invitations/${token}`),
  accept: (token: string) =>
    authRequest<{ message: string; data: Organization }>(`/api/invitations/${token}`, {
      method: "POST",
    }),
};

// ─── Templates ───
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

// ─── Emails ───
export const emails = {
  send: (data: SendEmail) =>
    request<{ data: { id: string; status: string; to: string; subject: string } }>(
      "/emails/send",
      { method: "POST", body: JSON.stringify(data) }
    ),
};

// ─── Logs ───
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
  quota: () => request<{ data: QuotaUsage }>("/logs/quota"),
};

// ─── Providers ───
export const providers = {
  list: () => request<{ data: ProviderInfo[] }>("/providers"),
  create: (data: CreateProvider) =>
    request<{ data: ProviderInfo }>("/providers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CreateProvider>) =>
    request<{ data: ProviderInfo }>(`/providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/providers/${id}`, { method: "DELETE" }),
  test: (id: string) =>
    request<{ message: string }>(`/providers/${id}/test`, { method: "POST" }),
};

// ─── Domains ───
export const domainsApi = {
  list: () => request<{ data: Domain[] }>("/domains"),
  create: (domain: string) =>
    request<{ data: Domain; dnsInstructions: DnsInstruction }>("/domains", {
      method: "POST",
      body: JSON.stringify({ domain }),
    }),
  verify: (id: string) =>
    request<{ data: Domain; message: string }>(`/domains/${id}/verify`, {
      method: "POST",
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/domains/${id}`, { method: "DELETE" }),
};

// ─── Sending Addresses ───
export const sendingAddressesApi = {
  list: () => request<{ data: SendingAddress[] }>("/sending-addresses"),
  create: (data: { address: string; displayName?: string; replyTo?: string }) =>
    request<{ data: SendingAddress }>("/sending-addresses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { displayName: string; replyTo?: string | null }) =>
    request<{ data: SendingAddress }>(`/sending-addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/sending-addresses/${id}`, { method: "DELETE" }),
};

// ─── Contacts ───
export const contactsApi = {
  list: (params?: { search?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set("search", params.search);
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.offset) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<{ data: Contact[]; total: number }>(`/contacts${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<{ data: Contact }>(`/contacts/${id}`),
  create: (data: { email: string; name?: string; metadata?: Record<string, string> }) =>
    request<{ data: Contact }>("/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { email?: string; name?: string; metadata?: Record<string, string> }) =>
    request<{ data: Contact }>(`/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/contacts/${id}`, { method: "DELETE" }),
  importGoogle: () =>
    request<{ data: { imported: number; skipped: number; total: number } }>(
      "/contacts/import/google",
      { method: "POST" }
    ),
  import: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (currentOrgId) headers["X-Org-Id"] = currentOrgId;
    return fetch(`${API_BASE}/contacts/import`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ data: { imported: number; skipped: number; total: number } }>;
    });
  },
};

// ─── Audiences ───
export const audiencesApi = {
  list: () => request<{ data: Audience[] }>("/audiences"),
  get: (id: string, params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.offset) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<{ data: AudienceDetail; total: number }>(`/audiences/${id}${qs ? `?${qs}` : ""}`);
  },
  create: (data: { name: string; description?: string }) =>
    request<{ data: Audience }>("/audiences", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<{ data: Audience }>(`/audiences/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/audiences/${id}`, { method: "DELETE" }),
  addContacts: (id: string, contactIds: string[]) =>
    request<{ data: Audience; added: number }>(`/audiences/${id}/contacts`, {
      method: "POST",
      body: JSON.stringify({ contactIds }),
    }),
  removeContact: (id: string, contactId: string) =>
    request<{ message: string }>(`/audiences/${id}/contacts/${contactId}`, {
      method: "DELETE",
    }),
};

// ─── Broadcasts ───
export const broadcastsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.offset) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<{ data: Broadcast[]; total: number }>(`/broadcasts${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<{ data: BroadcastDetail }>(`/broadcasts/${id}`),
  create: (data: {
    audienceId: string;
    templateId: string;
    fromAddressId: string;
    variables?: Record<string, string>;
    scheduledAt?: string;
  }) =>
    request<{ data: { id: string; status: string; scheduledAt: string | null; totalCount: number; subject: string } }>(
      "/broadcasts",
      { method: "POST", body: JSON.stringify(data) }
    ),
  cancel: (id: string) =>
    request<{ message: string }>(`/broadcasts/${id}/cancel`, { method: "POST" }),
  quickSend: (data: {
    contactIds: string[];
    templateId: string;
    fromAddressId: string;
    variables?: Record<string, string>;
  }) =>
    request<{ data: { id: string; status: string; totalCount: number; subject: string } }>(
      "/broadcasts/quick-send",
      { method: "POST", body: JSON.stringify(data) }
    ),
};

// ─── Webhooks ───
export const webhooksApi = {
  list: () => request<{ data: WebhookInfo[] }>("/webhooks"),
  get: (id: string) => request<{ data: WebhookDetail }>(`/webhooks/${id}`),
  create: (data: { url: string; events: string[] }) =>
    request<{ data: WebhookDetail & { secret: string }; message: string }>("/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { url?: string; events?: string[]; isActive?: boolean }) =>
    request<{ data: WebhookInfo }>(`/webhooks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/webhooks/${id}`, { method: "DELETE" }),
  logs: (id: string, params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.offset) sp.set("offset", String(params.offset));
    const qs = sp.toString();
    return request<{ data: WebhookLog[]; total: number }>(`/webhooks/${id}/logs${qs ? `?${qs}` : ""}`);
  },
  test: (id: string) =>
    request<{ message: string }>(`/webhooks/${id}/test`, { method: "POST" }),
  rotateSecret: (id: string) =>
    request<{ data: { secret: string }; message: string }>(`/webhooks/${id}/rotate-secret`, {
      method: "POST",
    }),
  events: () => request<{ data: string[] }>("/webhooks/meta/events"),
};

// ─── Compose ───
export const compose = {
  send: (data: {
    contactIds: string[];
    fromAddressId?: string;
    templateId?: string;
    subject?: string;
    bodyHtml?: string;
    variables?: Record<string, string>;
  }) =>
    request<{ data: { id: string; status: string; totalCount: number; subject: string } }>(
      "/compose/send",
      { method: "POST", body: JSON.stringify(data) }
    ),
};

// ─── API Keys ───
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

// ─── Types ───
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
}

export interface OrgWithRole extends Organization {
  role: "admin" | "member";
}

export interface OrgMember {
  id: string;
  role: string;
  joinedAt: string;
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface InvitationInfo {
  email: string;
  role: string;
  expiresAt: string;
  orgName: string;
}

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
  errorMessage: string | null;
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

export interface QuotaUsage {
  used: number;
  limit: number;
  date: string;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  type: "smtp" | "sendgrid" | "ses" | "gmail-oauth";
  config: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateProvider {
  name: string;
  type: "smtp" | "sendgrid" | "ses" | "gmail-oauth";
  config: Record<string, unknown>;
  isDefault?: boolean;
}

export interface Domain {
  id: string;
  domain: string;
  status: "pending" | "verified";
  verificationToken: string;
  createdAt: string;
}

export interface DnsInstruction {
  type: string;
  name: string;
  value: string;
  description: string;
}

export interface SendingAddress {
  id: string;
  address: string;
  displayName: string | null;
  replyTo: string | null;
  domainId: string | null;
  domain: string | null;
  domainStatus: string | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, string> | null;
  isUnsubscribed: boolean;
  createdAt: string;
}

export interface Audience {
  id: string;
  name: string;
  description: string | null;
  contactCount: number;
  createdAt: string;
}

export interface AudienceMember {
  id: string;
  email: string;
  name: string | null;
  isUnsubscribed: boolean;
  createdAt: string;
  addedAt: string;
}

export interface AudienceDetail extends Audience {
  contacts: AudienceMember[];
}

export interface Broadcast {
  id: string;
  audienceId: string;
  templateId: string;
  fromAddress: string;
  subject: string;
  scheduledAt: string | null;
  status: "draft" | "scheduled" | "sending" | "completed" | "failed";
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  completedAt: string | null;
  audienceName: string | null;
}

export interface BroadcastDetail extends Broadcast {
  orgId: string;
  fromAddressId: string;
  variables: Record<string, string> | null;
  templateName: string | null;
  logs: EmailLog[];
}

export interface WebhookInfo {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface WebhookDetail extends WebhookInfo {
  secret: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  response: string | null;
  success: boolean;
  attempts: number;
  createdAt: string;
}
