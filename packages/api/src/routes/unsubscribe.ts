import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { unsubscribes } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { dispatchWebhookEvent } from "../services/webhook-dispatcher.js";
import { buildUnsubscribePayload } from "../services/webhook-events.js";

const app = new Hono();

// Token format: base64url(orgId:email)
function decodeToken(token: string): { orgId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) {
      // Legacy format: just email (no orgId) — treat as invalid
      return null;
    }
    return {
      orgId: decoded.slice(0, colonIdx),
      email: decoded.slice(colonIdx + 1),
    };
  } catch {
    return null;
  }
}

// Unsubscribe landing page (GET)
app.get("/:token", async (c) => {
  const parsed = decodeToken(c.req.param("token"));
  if (!parsed) {
    return c.html("<h1>Invalid link</h1>", 400);
  }

  const { email } = parsed;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>配信停止</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; color: #333; }
    h1 { font-size: 1.5rem; }
    .btn { background: #1f2937; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 1rem; cursor: pointer; }
    .btn:hover { background: #374151; }
  </style>
</head>
<body>
  <h1>配信停止</h1>
  <p><strong>${email}</strong> 宛のメール配信を停止しますか？</p>
  <form method="POST">
    <textarea name="reason" placeholder="理由（任意）" rows="3" style="width: 100%; margin-bottom: 12px; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"></textarea>
    <button type="submit" class="btn">配信を停止する</button>
  </form>
</body>
</html>`;

  return c.html(html);
});

// RFC 8058 one-click unsubscribe (POST with List-Unsubscribe=One-Click body)
app.post("/:token", async (c) => {
  const parsed = decodeToken(c.req.param("token"));
  if (!parsed) {
    return c.html("<h1>Invalid link</h1>", 400);
  }

  const { orgId, email } = parsed;

  // Detect RFC 8058 one-click request (Content-Type: application/x-www-form-urlencoded with List-Unsubscribe=One-Click)
  const formData = await c.req.parseBody();
  const isOneClick = formData["List-Unsubscribe"] === "One-Click";
  const reason = isOneClick ? null : ((formData.reason as string) || null);

  // Check if already unsubscribed
  const [existing] = await db
    .select()
    .from(unsubscribes)
    .where(and(eq(unsubscribes.orgId, orgId), eq(unsubscribes.email, email)))
    .limit(1);

  if (!existing) {
    await db.insert(unsubscribes).values({
      id: generateId("unsub"),
      orgId,
      email,
      reason,
      source: "link",
      unsubscribedAt: new Date().toISOString(),
    });

    dispatchWebhookEvent(
      orgId,
      "contact.unsubscribed",
      buildUnsubscribePayload(orgId, { email, reason, source: "link" })
    );
  }

  // RFC 8058: Return 200 for one-click requests
  if (isOneClick) {
    return c.text("Unsubscribed", 200);
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>配信停止完了</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; color: #333; }
    h1 { font-size: 1.5rem; color: #059669; }
  </style>
</head>
<body>
  <h1>配信停止が完了しました</h1>
  <p><strong>${email}</strong> への配信を停止しました。</p>
  <p>今後メールは届きません。再度受信を希望する場合はお問い合わせください。</p>
</body>
</html>`;

  return c.html(html);
});

export default app;
