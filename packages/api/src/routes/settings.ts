import { Hono } from "hono";
import { z } from "zod";
import {
  getSmtpConfigMasked,
  setSmtpConfig,
} from "../services/settings.js";
import {
  verifySmtpConnection,
  resetTransporter,
  sendMail,
} from "../services/mailer.js";

const app = new Hono();

const updateSmtpSchema = z.object({
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.string().min(1).optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPass: z.string().min(1).optional(),
  fromAddress: z.string().email().optional(),
  fromName: z.string().min(1).optional(),
});

// Get SMTP settings (password masked)
app.get("/smtp", (c) => {
  return c.json({ data: getSmtpConfigMasked() });
});

// Update SMTP settings
app.put("/smtp", async (c) => {
  const body = await c.req.json();
  const parsed = updateSmtpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  // Filter out masked password
  const updates = { ...parsed.data };
  if (updates.smtpPass === "••••••••") {
    delete updates.smtpPass;
  }

  setSmtpConfig(updates);
  resetTransporter();

  return c.json({ data: getSmtpConfigMasked(), message: "SMTP設定を更新しました" });
});

// Test SMTP connection
app.post("/smtp/test-connection", async (c) => {
  resetTransporter();
  const result = await verifySmtpConnection();

  if (result.success) {
    return c.json({ message: "SMTP接続に成功しました" });
  }
  return c.json(
    { error: "SMTP接続に失敗しました", details: result.error },
    400
  );
});

// Send test email
app.post("/smtp/test-send", async (c) => {
  const body = await c.req.json();
  const parsed = z
    .object({ to: z.string().email() })
    .safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  try {
    await sendMail({
      to: parsed.data.to,
      subject: "[TalentMail] テスト送信",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h1 style="font-size: 20px; color: #111827;">TalentMail テスト送信</h1>
          <p style="color: #4b5563;">このメールはSMTP設定のテストとして送信されました。</p>
          <p style="color: #4b5563;">正常に受信できていれば、SMTP設定は正しく構成されています。</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="font-size: 12px; color: #9ca3af;">送信日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
        </div>
      `,
    });
    return c.json({ message: `テストメールを ${parsed.data.to} に送信しました` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "テストメール送信に失敗しました", details: message }, 500);
  }
});

export default app;
