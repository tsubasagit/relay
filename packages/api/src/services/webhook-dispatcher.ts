import { createHmac, randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { webhooks, webhookLogs } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import type { WebhookEvent, WebhookPayload } from "./webhook-events.js";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispatch a webhook event to all matching webhooks for an org.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function dispatchWebhookEvent(
  orgId: string,
  event: WebhookEvent,
  payload: WebhookPayload
): Promise<void> {
  try {
    const hooks = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.orgId, orgId), eq(webhooks.isActive, true)));

    const matching = hooks.filter((h) => {
      const events = h.events as string[];
      return events.includes(event) || events.includes("*");
    });

    for (const hook of matching) {
      // Fire and forget
      deliverWebhook(hook, event, payload, orgId).catch((err) => {
        console.error(`Webhook delivery failed for ${hook.id}:`, err);
      });
    }
  } catch (err) {
    console.error("Webhook dispatch error:", err);
  }
}

async function deliverWebhook(
  hook: { id: string; url: string; secret: string },
  event: WebhookEvent,
  payload: WebhookPayload,
  orgId: string
): Promise<void> {
  const body = JSON.stringify(payload);
  const deliveryId = generateId("whd");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(body, hook.secret);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Relay-Signature": `sha256=${signature}`,
    "X-Relay-Event": event,
    "X-Relay-Delivery": deliveryId,
    "X-Relay-Timestamp": timestamp,
    "User-Agent": "Relay-Webhook/1.0",
  };

  let lastStatusCode: number | null = null;
  let lastResponse: string | null = null;
  let success = false;
  let attempts = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    attempts = i + 1;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(hook.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatusCode = res.status;
      lastResponse = await res.text().catch(() => "");

      if (res.ok) {
        success = true;
        break;
      }
    } catch (err) {
      lastResponse = err instanceof Error ? err.message : "Unknown error";
    }

    // Wait before retry
    if (i < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[i]));
    }
  }

  // Log the delivery attempt
  await db.insert(webhookLogs).values({
    id: generateId("whl"),
    webhookId: hook.id,
    orgId,
    event,
    payload: payload as unknown as Record<string, unknown>,
    statusCode: lastStatusCode,
    response: lastResponse ? lastResponse.slice(0, 1000) : null,
    success,
    attempts,
    createdAt: new Date().toISOString(),
  });
}
