import { Hono } from "hono";
import { eq, and, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { broadcasts, templates, sendingAddresses, domains } from "../db/schema.js";
import { processBroadcast } from "../services/broadcast-processor.js";
import { config } from "../config.js";

const app = new Hono();

// GET /api/scheduler/process-scheduled
// Cloud Scheduler が定期的に呼び出す。SCHEDULER_SECRET で認証。
app.get("/process-scheduled", async (c) => {
  const secret = c.req.header("X-Scheduler-Secret");
  if (!config.schedulerSecret || secret !== config.schedulerSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const now = new Date().toISOString();

  // 送信時刻に達した scheduled broadcasts を取得
  const dueBroadcasts = await db
    .select()
    .from(broadcasts)
    .where(
      and(
        eq(broadcasts.status, "scheduled"),
        lte(broadcasts.scheduledAt, now)
      )
    );

  if (dueBroadcasts.length === 0) {
    return c.json({ processed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const bc of dueBroadcasts) {
    try {
      // テンプレート取得
      const [tmpl] = await db
        .select()
        .from(templates)
        .where(eq(templates.id, bc.templateId))
        .limit(1);

      if (!tmpl) {
        await db
          .update(broadcasts)
          .set({ status: "failed", completedAt: new Date().toISOString() })
          .where(eq(broadcasts.id, bc.id));
        failed++;
        continue;
      }

      // ステータスを sending に更新
      await db
        .update(broadcasts)
        .set({ status: "sending" })
        .where(eq(broadcasts.id, bc.id));

      // contactIds (compose 経由) or audienceId (broadcast 経由) で送信
      const contactIds = (bc.contactIds as string[]) || [];

      await processBroadcast(
        bc.orgId,
        bc.id,
        bc.audienceId,
        {
          id: tmpl.id,
          subject: tmpl.subject,
          bodyHtml: tmpl.bodyHtml,
          bodyText: tmpl.bodyText,
          category: tmpl.category,
        },
        bc.fromAddress,
        (bc.variables as Record<string, string>) || {},
        undefined,
        contactIds.length > 0 ? contactIds : undefined
      );

      processed++;
    } catch (err) {
      console.error(`Scheduler: broadcast ${bc.id} failed:`, err);
      await db
        .update(broadcasts)
        .set({ status: "failed", completedAt: new Date().toISOString() })
        .where(eq(broadcasts.id, bc.id));
      failed++;
    }
  }

  return c.json({ processed, failed, total: dueBroadcasts.length });
});

export default app;
