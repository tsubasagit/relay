import { pgTable, text, integer, boolean, primaryKey, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

// ─── Auth & Organization ───

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  createdAt: text("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["free", "pro", "enterprise"] }).notNull().default("free"),
  createdAt: text("created_at").notNull(),
});

export const orgMembers = pgTable("org_members", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  joinedAt: text("joined_at").notNull(),
}, (table) => [
  uniqueIndex("org_members_org_user_idx").on(table.orgId, table.userId),
]);

export const orgInvitations = pgTable("org_invitations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Domains & Sending Addresses ───

export const domains = pgTable("domains", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  domain: text("domain").notNull(),
  status: text("status", { enum: ["pending", "verified"] }).notNull().default("pending"),
  verificationToken: text("verification_token").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("domains_org_domain_idx").on(table.orgId, table.domain),
]);

export const sendingAddresses = pgTable("sending_addresses", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  domainId: text("domain_id").references(() => domains.id),
  address: text("address").notNull(),
  displayName: text("display_name"),
  replyTo: text("reply_to"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("sending_addresses_org_address_idx").on(table.orgId, table.address),
]);

// ─── Email Providers ───

export const emailProviders = pgTable("email_providers", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["smtp", "sendgrid", "ses", "gmail-oauth"] }).notNull(),
  config: text("config").notNull(), // AES-256-GCM encrypted JSON
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// ─── Existing tables (with orgId) ───

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: jsonb("scopes").notNull().$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  variables: jsonb("variables").$type<string[]>().default([]),
  category: text("category", { enum: ["transactional", "marketing"] })
    .notNull()
    .default("transactional"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const emailLogs = pgTable("email_logs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  templateId: text("template_id").references(() => templates.id),
  broadcastId: text("broadcast_id"),
  contactId: text("contact_id"),
  audienceId: text("audience_id"),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  status: text("status", {
    enum: ["queued", "sent", "bounced", "failed"],
  })
    .notNull()
    .default("queued"),
  errorMessage: text("error_message"),
  openedAt: text("opened_at"),
  clickedAt: text("clicked_at"),
  clickedUrl: text("clicked_url"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
});

export const unsubscribes = pgTable("unsubscribes", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  email: text("email").notNull(),
  reason: text("reason"),
  source: text("source", { enum: ["link", "manual", "api"] })
    .notNull()
    .default("manual"),
  unsubscribedAt: text("unsubscribed_at").notNull(),
}, (table) => [
  uniqueIndex("unsubscribes_org_email_idx").on(table.orgId, table.email),
]);

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  email: text("email").notNull(),
  name: text("name"),
  metadata: jsonb("metadata").$type<Record<string, string>>(),
  isUnsubscribed: boolean("is_unsubscribed").notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("contacts_org_email_idx").on(table.orgId, table.email),
]);

export const audiences = pgTable("audiences", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  contactCount: integer("contact_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const broadcasts = pgTable("broadcasts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  audienceId: text("audience_id").notNull().references(() => audiences.id),
  templateId: text("template_id").notNull().references(() => templates.id),
  fromAddressId: text("from_address_id").notNull(),
  fromAddress: text("from_address").notNull(),
  subject: text("subject").notNull(),
  variables: jsonb("variables").$type<Record<string, string>>(),
  scheduledAt: text("scheduled_at"),
  status: text("status", {
    enum: ["draft", "scheduled", "sending", "completed", "failed"],
  }).notNull().default("draft"),
  totalCount: integer("total_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

// ─── Webhooks ───

export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: jsonb("events").notNull().$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const webhookLogs = pgTable("webhook_logs", {
  id: text("id").primaryKey(),
  webhookId: text("webhook_id").notNull().references(() => webhooks.id),
  orgId: text("org_id").notNull().references(() => organizations.id),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  statusCode: integer("status_code"),
  response: text("response"),
  success: boolean("success").notNull().default(false),
  attempts: integer("attempts").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

// ─── Email Quota ───

export const emailQuota = pgTable("email_quota", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id),
  date: text("date").notNull(), // YYYY-MM-DD
  sentCount: integer("sent_count").notNull().default(0),
}, (table) => [
  uniqueIndex("email_quota_org_date_idx").on(table.orgId, table.date),
]);

export const audienceContacts = pgTable("audience_contacts", {
  audienceId: text("audience_id")
    .notNull()
    .references(() => audiences.id),
  contactId: text("contact_id")
    .notNull(),
  addedAt: text("added_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.audienceId, table.contactId] }),
]);
