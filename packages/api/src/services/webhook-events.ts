export const WEBHOOK_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.failed",
  "email.opened",
  "email.clicked",
  "contact.unsubscribed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

interface BasePayload {
  event: WebhookEvent;
  timestamp: string;
  orgId: string;
}

export interface EmailEventPayload extends BasePayload {
  data: {
    logId: string;
    to: string;
    from?: string;
    subject?: string;
    templateId?: string;
    broadcastId?: string;
    clickedUrl?: string;
  };
}

export interface UnsubscribeEventPayload extends BasePayload {
  data: {
    email: string;
    reason?: string | null;
    source: string;
  };
}

export type WebhookPayload = EmailEventPayload | UnsubscribeEventPayload;

export function buildEmailPayload(
  event: WebhookEvent,
  orgId: string,
  data: EmailEventPayload["data"]
): EmailEventPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    orgId,
    data,
  };
}

export function buildUnsubscribePayload(
  orgId: string,
  data: UnsubscribeEventPayload["data"]
): UnsubscribeEventPayload {
  return {
    event: "contact.unsubscribed",
    timestamp: new Date().toISOString(),
    orgId,
    data,
  };
}
