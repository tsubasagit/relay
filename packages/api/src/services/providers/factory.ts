import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { emailProviders } from "../../db/schema.js";
import { decrypt } from "../../utils/crypto.js";
import { SmtpProvider } from "./smtp.js";
import { SendGridProvider } from "./sendgrid.js";
import { SesProvider } from "./ses.js";
import { GmailOAuthProvider } from "./gmail-oauth.js";
import type { EmailProvider, ProviderType } from "./types.js";

export function createProvider(type: ProviderType, configJson: string): EmailProvider {
  const config = JSON.parse(configJson);

  switch (type) {
    case "smtp":
      return new SmtpProvider(config);
    case "sendgrid":
      return new SendGridProvider(config);
    case "ses":
      return new SesProvider(config);
    case "gmail-oauth":
      return new GmailOAuthProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Get the default email provider for an organization.
 * Falls back to the first available provider if no default is set.
 */
export async function getOrgProvider(orgId: string): Promise<{ provider: EmailProvider; record: typeof emailProviders.$inferSelect } | null> {
  // Try default first
  let [record] = await db
    .select()
    .from(emailProviders)
    .where(and(eq(emailProviders.orgId, orgId), eq(emailProviders.isDefault, true)))
    .limit(1);

  // Fall back to any provider
  if (!record) {
    [record] = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.orgId, orgId))
      .limit(1);
  }

  if (!record) return null;

  const decryptedConfig = decrypt(record.config);
  const provider = createProvider(record.type as ProviderType, decryptedConfig);
  return { provider, record };
}
