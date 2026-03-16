import { neon } from "@neondatabase/serverless";
import { config } from "../config.js";

export async function initDatabase(): Promise<void> {
  const sql = neon(config.databaseUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      google_access_token TEXT,
      google_refresh_token TEXT,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS org_members (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS org_members_org_user_idx ON org_members(org_id, user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS org_invitations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      token TEXT NOT NULL UNIQUE,
      invited_by TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      domain TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      verification_token TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS domains_org_domain_idx ON domains(org_id, domain)`;

  await sql`
    CREATE TABLE IF NOT EXISTS sending_addresses (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      domain_id TEXT REFERENCES domains(id),
      address TEXT NOT NULL,
      display_name TEXT,
      reply_to TEXT,
      created_at TEXT NOT NULL
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS sending_addresses_org_address_idx ON sending_addresses(org_id, address)`;

  await sql`
    CREATE TABLE IF NOT EXISTS email_providers (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      variables JSONB DEFAULT '[]',
      category TEXT NOT NULL DEFAULT 'transactional',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      template_id TEXT REFERENCES templates(id),
      broadcast_id TEXT,
      contact_id TEXT,
      audience_id TEXT,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      error_message TEXT,
      opened_at TEXT,
      clicked_at TEXT,
      clicked_url TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS unsubscribes (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL,
      reason TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      unsubscribed_at TEXT NOT NULL
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS unsubscribes_org_email_idx ON unsubscribes(org_id, email)`;

  await sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL,
      name TEXT,
      metadata JSONB,
      is_unsubscribed BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_email_idx ON contacts(org_id, email)`;

  await sql`
    CREATE TABLE IF NOT EXISTS audiences (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      contact_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      audience_id TEXT NOT NULL REFERENCES audiences(id),
      template_id TEXT NOT NULL REFERENCES templates(id),
      from_address_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      variables JSONB,
      scheduled_at TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS audience_contacts (
      audience_id TEXT NOT NULL REFERENCES audiences(id),
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      added_at TEXT NOT NULL,
      PRIMARY KEY (audience_id, contact_id)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL REFERENCES webhooks(id),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      event TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      status_code INTEGER,
      response TEXT,
      success BOOLEAN NOT NULL DEFAULT false,
      attempts INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS email_quota (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      date TEXT NOT NULL,
      sent_count INTEGER NOT NULL DEFAULT 0
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS email_quota_org_date_idx ON email_quota(org_id, date)`;

  console.log("Database initialized.");
}
