import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { emailQuota, organizations, orgMembers, users } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { config } from "../config.js";
import { getOrgProvider } from "./providers/factory.js";
import { SmtpProvider } from "./providers/smtp.js";
import { GmailOAuthProvider } from "./providers/gmail-oauth.js";
import type { EmailProvider, SendOptions } from "./providers/types.js";

export type { SendOptions };

const QUOTA_LIMITS: Record<string, number> = {
  free: 500,
  pro: 10000,
  enterprise: 100000,
};

/**
 * Create a default SMTP provider from env config (Gmail).
 * Returns null if env vars are not set.
 */
function getDefaultProvider(): EmailProvider | null {
  if (!config.defaultSmtpUser || !config.defaultSmtpPass) {
    return null;
  }
  return new SmtpProvider({
    host: config.defaultSmtpHost,
    port: config.defaultSmtpPort,
    username: config.defaultSmtpUser,
    password: config.defaultSmtpPass,
  });
}

/**
 * 日次クォータをチェックし、送信可能なら送信カウントを加算。
 */
async function checkAndIncrementQuota(orgId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // 組織のプランを取得
  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const limit = QUOTA_LIMITS[org?.plan || "free"] || QUOTA_LIMITS.free;

  // 本日のクォータ取得 or 作成
  const [existing] = await db
    .select()
    .from(emailQuota)
    .where(and(eq(emailQuota.orgId, orgId), eq(emailQuota.date, today)))
    .limit(1);

  if (existing) {
    if (existing.sentCount >= limit) {
      throw new Error(
        `本日の送信上限（${limit}通）に達しました。明日以降にお試しください。`
      );
    }
    await db
      .update(emailQuota)
      .set({ sentCount: existing.sentCount + 1 })
      .where(eq(emailQuota.id, existing.id));
  } else {
    await db.insert(emailQuota).values({
      id: generateId("quota"),
      orgId,
      date: today,
      sentCount: 1,
    });
  }
}

/**
 * Get the current quota usage for an organization.
 */
export async function getQuotaUsage(orgId: string): Promise<{ used: number; limit: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);

  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const limit = QUOTA_LIMITS[org?.plan || "free"] || QUOTA_LIMITS.free;

  const [existing] = await db
    .select({ sentCount: emailQuota.sentCount })
    .from(emailQuota)
    .where(and(eq(emailQuota.orgId, orgId), eq(emailQuota.date, today)))
    .limit(1);

  return { used: existing?.sentCount ?? 0, limit, date: today };
}

/**
 * Send an email using the organization's configured provider.
 * Falls back to the default SMTP provider if none is configured.
 * Enforces daily quota limits.
 */
export async function sendMail(orgId: string, options: SendOptions): Promise<void> {
  // クォータチェック & インクリメント
  await checkAndIncrementQuota(orgId);

  const result = await getOrgProvider(orgId);

  if (result) {
    await result.provider.send(options);
    return;
  }

  // Fallback to default SMTP provider
  const defaultProvider = getDefaultProvider();
  if (defaultProvider) {
    const fromAddress = options.from || config.defaultFrom;
    if (!fromAddress) {
      throw new Error("No from address configured");
    }
    await defaultProvider.send({ ...options, from: fromAddress });
    return;
  }

  // Fallback to Gmail OAuth: find an org member with a Google refresh token
  const [member] = await db
    .select({ userId: users.id, email: users.email })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.role, "admin")
      )
    )
    .limit(1);

  if (!member) {
    throw new Error("メールプロバイダーが設定されていません。プロバイダー設定からGmail等を追加してください。");
  }

  const gmailProvider = new GmailOAuthProvider({ userId: member.userId, email: member.email });
  await gmailProvider.send(options);
}

/**
 * Verify the organization's default provider connection.
 * Falls back to verifying the default SMTP provider.
 */
export async function verifyConnection(orgId: string): Promise<{ success: boolean; error?: string }> {
  const result = await getOrgProvider(orgId);
  if (result) {
    return result.provider.verify();
  }

  const defaultProvider = getDefaultProvider();
  if (!defaultProvider) {
    return { success: false, error: "No email provider configured" };
  }

  return defaultProvider.verify();
}

/**
 * Check if the default SMTP provider is available.
 */
export function hasDefaultProvider(): boolean {
  return !!(config.defaultSmtpUser && config.defaultSmtpPass);
}
