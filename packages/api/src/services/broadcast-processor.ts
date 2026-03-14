import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  broadcasts,
  audienceContacts,
  contacts,
  emailLogs,
  unsubscribes,
} from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { sendMail } from "./mailer.js";
import { renderTemplate } from "./template.js";
import { buildUnsubscribeData } from "./unsubscribe-helper.js";
import { dispatchWebhookEvent } from "./webhook-dispatcher.js";
import { buildEmailPayload } from "./webhook-events.js";
import { config } from "../config.js";

export async function processBroadcast(
  orgId: string,
  broadcastId: string,
  audienceId: string,
  tmpl: {
    id: string;
    subject: string;
    bodyHtml: string;
    bodyText: string | null;
    category: string;
  },
  fromAddress: string,
  variables: Record<string, string>
) {
  try {
    // Get all contacts in audience
    const members = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        name: contacts.name,
        isUnsubscribed: contacts.isUnsubscribed,
      })
      .from(audienceContacts)
      .innerJoin(contacts, eq(audienceContacts.contactId, contacts.id))
      .where(eq(audienceContacts.audienceId, audienceId));

    // Get unsubscribed emails for this org
    const unsubs = await db
      .select({ email: unsubscribes.email })
      .from(unsubscribes)
      .where(eq(unsubscribes.orgId, orgId));

    const unsubSet = new Set(unsubs.map((u) => u.email.toLowerCase()));

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const member of members) {
      // Check unsubscribe status
      if (member.isUnsubscribed || unsubSet.has(member.email.toLowerCase())) {
        skippedCount++;
        await db
          .update(broadcasts)
          .set({ skippedCount })
          .where(eq(broadcasts.id, broadcastId));
        continue;
      }

      // Merge variables with contact info
      const mergedVars = {
        ...variables,
        email: member.email,
        name: member.name || "",
      };

      const subject = renderTemplate(tmpl.subject, mergedVars);

      let html = renderTemplate(tmpl.bodyHtml, mergedVars);
      let text: string | undefined;
      if (tmpl.bodyText) {
        text = renderTemplate(tmpl.bodyText, mergedVars);
      }

      // Add unsubscribe footer & headers for marketing emails
      let emailHeaders: Record<string, string> | undefined;
      if (tmpl.category === "marketing") {
        const unsub = buildUnsubscribeData(config.baseUrl, orgId, member.email);
        html += unsub.htmlFooter;
        if (text) text += unsub.textFooter;
        emailHeaders = unsub.headers;
      }

      const logId = generateId("log");
      const now = new Date().toISOString();

      // Create log entry
      await db.insert(emailLogs).values({
        id: logId,
        orgId,
        templateId: tmpl.id,
        broadcastId,
        contactId: member.id,
        audienceId,
        fromAddress,
        toAddress: member.email,
        subject,
        status: "queued",
        createdAt: now,
      });

      try {
        await sendMail(orgId, {
          from: fromAddress,
          to: member.email,
          subject,
          html,
          text,
          headers: emailHeaders,
        });

        await db
          .update(emailLogs)
          .set({ status: "sent", sentAt: new Date().toISOString() })
          .where(eq(emailLogs.id, logId));

        dispatchWebhookEvent(
          orgId,
          "email.sent",
          buildEmailPayload("email.sent", orgId, {
            logId,
            to: member.email,
            from: fromAddress,
            subject,
            templateId: tmpl.id,
            broadcastId,
          })
        );

        sentCount++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        await db
          .update(emailLogs)
          .set({ status: "failed", errorMessage })
          .where(eq(emailLogs.id, logId));

        dispatchWebhookEvent(
          orgId,
          "email.failed",
          buildEmailPayload("email.failed", orgId, {
            logId,
            to: member.email,
            from: fromAddress,
            subject,
            templateId: tmpl.id,
            broadcastId,
          })
        );

        failedCount++;
      }

      // Update broadcast progress
      await db
        .update(broadcasts)
        .set({ sentCount, failedCount, skippedCount })
        .where(eq(broadcasts.id, broadcastId));

      // Rate limiting: 50ms between sends
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Mark completed
    await db
      .update(broadcasts)
      .set({
        status: "completed",
        sentCount,
        failedCount,
        skippedCount,
        completedAt: new Date().toISOString(),
      })
      .where(eq(broadcasts.id, broadcastId));
  } catch (err) {
    console.error(`Broadcast ${broadcastId} error:`, err);
    await db
      .update(broadcasts)
      .set({ status: "failed", completedAt: new Date().toISOString() })
      .where(eq(broadcasts.id, broadcastId));
  }
}
