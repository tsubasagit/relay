import { getOrgProvider } from "./providers/factory.js";
import type { SendOptions } from "./providers/types.js";

export type { SendOptions };

/**
 * Send an email using the organization's configured provider.
 */
export async function sendMail(orgId: string, options: SendOptions): Promise<void> {
  const result = await getOrgProvider(orgId);
  if (!result) {
    throw new Error("No email provider configured for this organization");
  }

  await result.provider.send(options);
}

/**
 * Verify the organization's default provider connection.
 */
export async function verifyConnection(orgId: string): Promise<{ success: boolean; error?: string }> {
  const result = await getOrgProvider(orgId);
  if (!result) {
    return { success: false, error: "No email provider configured" };
  }

  return result.provider.verify();
}
