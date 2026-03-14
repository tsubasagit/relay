import { eq, and, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { broadcasts, templates, sendingAddresses, domains } from "../db/schema.js";
import { processBroadcast } from "./broadcast-processor.js";

const INTERVAL_MS = 30_000; // 30 seconds

/**
 * Starts a scheduler that checks for scheduled broadcasts every 30 seconds.
 */
export function startScheduler(): void {
  console.log("Broadcast scheduler started (30s interval)");

  setInterval(async () => {
    try {
      const now = new Date().toISOString();

      // Find scheduled broadcasts whose time has come
      const due = await db
        .select()
        .from(broadcasts)
        .where(
          and(
            eq(broadcasts.status, "scheduled"),
            lte(broadcasts.scheduledAt, now)
          )
        );

      for (const broadcast of due) {
        // Fetch template
        const [tmpl] = await db
          .select()
          .from(templates)
          .where(eq(templates.id, broadcast.templateId))
          .limit(1);

        if (!tmpl) {
          await db
            .update(broadcasts)
            .set({ status: "failed", completedAt: now })
            .where(eq(broadcasts.id, broadcast.id));
          continue;
        }

        // Update status to sending
        await db
          .update(broadcasts)
          .set({ status: "sending" })
          .where(eq(broadcasts.id, broadcast.id));

        // Start processing in background
        processBroadcast(
          broadcast.orgId,
          broadcast.id,
          broadcast.audienceId,
          {
            id: tmpl.id,
            subject: tmpl.subject,
            bodyHtml: tmpl.bodyHtml,
            bodyText: tmpl.bodyText,
            category: tmpl.category,
          },
          broadcast.fromAddress,
          (broadcast.variables as Record<string, string>) || {}
        ).catch((err) => {
          console.error(`Scheduled broadcast ${broadcast.id} failed:`, err);
        });
      }
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }, INTERVAL_MS);
}
