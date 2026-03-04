import { sqlite } from "./client.js";

export function initDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      variables TEXT DEFAULT '[]',
      category TEXT NOT NULL DEFAULT 'transactional',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      template_id TEXT REFERENCES templates(id),
      contact_id TEXT,
      audience_id TEXT,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      opened_at TEXT,
      clicked_at TEXT,
      clicked_url TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unsubscribes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      reason TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      unsubscribed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      metadata TEXT,
      is_unsubscribed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audiences (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      contact_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audience_contacts (
      audience_id TEXT NOT NULL REFERENCES audiences(id),
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      added_at TEXT NOT NULL,
      PRIMARY KEY (audience_id, contact_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  console.log("Database initialized.");
}
