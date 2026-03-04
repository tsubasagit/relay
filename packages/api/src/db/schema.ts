import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: text("scopes", { mode: "json" }).notNull().$type<string[]>(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  variables: text("variables", { mode: "json" }).$type<string[]>().default([]),
  category: text("category", { enum: ["transactional", "marketing"] })
    .notNull()
    .default("transactional"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const emailLogs = sqliteTable("email_logs", {
  id: text("id").primaryKey(),
  templateId: text("template_id").references(() => templates.id),
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
  openedAt: text("opened_at"),
  clickedAt: text("clicked_at"),
  clickedUrl: text("clicked_url"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull(),
});

export const unsubscribes = sqliteTable("unsubscribes", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  reason: text("reason"),
  source: text("source", { enum: ["link", "manual", "api"] })
    .notNull()
    .default("manual"),
  unsubscribedAt: text("unsubscribed_at").notNull(),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, string>>(),
  isUnsubscribed: integer("is_unsubscribed", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
});

export const audiences = sqliteTable("audiences", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  contactCount: integer("contact_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const audienceContacts = sqliteTable("audience_contacts", {
  audienceId: text("audience_id")
    .notNull()
    .references(() => audiences.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  addedAt: text("added_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
