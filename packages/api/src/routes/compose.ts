import { Hono } from "hono";
import { z } from "zod";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  contacts,
  templates,
  sendingAddresses,
  domains,
  audiences,
  audienceContacts,
  broadcasts,
  emailLogs,
  emailQuota,
} from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { renderTemplate } from "../services/template.js";
import { processBroadcast } from "../services/broadcast-processor.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

// POST /api/compose/send
// コンタクト選択 + 件名/本文(or テンプレート) → 一時オーディエンス作成 → ブロードキャスト実行
app.post("/send", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();

  const schema = z.object({
    contactIds: z.array(z.string()).min(1, "宛先を1件以上選択してください"),
    fromAddressId: z.string().optional(),
    templateId: z.string().optional(),
    subject: z.string().optional(),
    bodyHtml: z.string().optional(),
    variables: z.record(z.string()).optional(),
  }).refine(
    (d) => d.templateId || (d.subject && d.bodyHtml),
    { message: "テンプレートIDか、件名と本文を指定してください" }
  );

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { contactIds, fromAddressId, templateId, subject, bodyHtml, variables } = parsed.data;

  // テンプレート解決（templateIdがあればDB取得、なければインライン）
  let tmpl: { id: string; subject: string; bodyHtml: string; bodyText: string | null; category: string };

  if (templateId) {
    const [found] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.orgId, auth.orgId)))
      .limit(1);
    if (!found) {
      return c.json({ error: "テンプレートが見つかりません" }, 404);
    }
    tmpl = { id: found.id, subject: found.subject, bodyHtml: found.bodyHtml, bodyText: found.bodyText, category: found.category };
  } else {
    // インラインテンプレートを一時作成
    const tmplId = generateId("tmpl");
    const now = new Date().toISOString();
    await db.insert(templates).values({
      id: tmplId,
      orgId: auth.orgId,
      name: `メール作成 ${new Date().toLocaleDateString("ja-JP")}`,
      subject: subject!,
      bodyHtml: bodyHtml!,
      bodyText: null,
      variables: [],
      category: "marketing",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    tmpl = { id: tmplId, subject: subject!, bodyHtml: bodyHtml!, bodyText: null, category: "marketing" };
  }

  // 送信アドレス取得（指定なしの場合はorgのデフォルト送信アドレス）
  let addr: { id: string; address: string; displayName: string | null; domainId: string | null; domainStatus: string | null };

  if (fromAddressId) {
    const [found] = await db
      .select({
        id: sendingAddresses.id,
        address: sendingAddresses.address,
        displayName: sendingAddresses.displayName,
        domainId: sendingAddresses.domainId,
        domainStatus: domains.status,
      })
      .from(sendingAddresses)
      .leftJoin(domains, eq(sendingAddresses.domainId, domains.id))
      .where(and(eq(sendingAddresses.id, fromAddressId), eq(sendingAddresses.orgId, auth.orgId)))
      .limit(1);
    if (!found) {
      return c.json({ error: "送信アドレスが見つかりません" }, 404);
    }
    addr = found;
  } else {
    // デフォルト送信アドレスを取得
    const [found] = await db
      .select({
        id: sendingAddresses.id,
        address: sendingAddresses.address,
        displayName: sendingAddresses.displayName,
        domainId: sendingAddresses.domainId,
        domainStatus: domains.status,
      })
      .from(sendingAddresses)
      .leftJoin(domains, eq(sendingAddresses.domainId, domains.id))
      .where(eq(sendingAddresses.orgId, auth.orgId))
      .limit(1);
    if (!found) {
      return c.json({ error: "送信アドレスが設定されていません" }, 404);
    }
    addr = found;
  }

  if (addr.domainId && addr.domainStatus !== "verified") {
    return c.json({ error: "ドメインが検証されていません" }, 400);
  }

  // クォータチェック
  const today = new Date().toISOString().slice(0, 10);
  const [quota] = await db
    .select({ sentCount: emailQuota.sentCount })
    .from(emailQuota)
    .where(and(eq(emailQuota.orgId, auth.orgId), eq(emailQuota.date, today)))
    .limit(1);

  const currentSent = quota?.sentCount ?? 0;
  const dailyLimit = auth.plan === "free" ? 500 : 10000;
  if (currentSent + contactIds.length > dailyLimit) {
    return c.json({
      error: `本日の送信上限（${dailyLimit}通）を超えます。残り: ${dailyLimit - currentSent}通`,
    }, 429);
  }

  // コンタクト検証
  const validContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.orgId, auth.orgId), inArray(contacts.id, contactIds)));

  if (validContacts.length === 0) {
    return c.json({ error: "有効なコンタクトが見つかりません" }, 400);
  }

  const fromAddr = addr.displayName
    ? `${addr.displayName} <${addr.address}>`
    : addr.address;

  const renderedSubject = renderTemplate(tmpl.subject, variables || {});
  const now = new Date();
  const nowStr = now.toISOString();

  // 一時オーディエンス作成
  const audienceId = generateId("aud");
  const audienceName = `メール作成 ${now.toLocaleDateString("ja-JP")} ${now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;

  await db.insert(audiences).values({
    id: audienceId,
    orgId: auth.orgId,
    name: audienceName,
    description: `Composeから${validContacts.length}件に送信`,
    contactCount: validContacts.length,
    createdAt: nowStr,
  });

  await db.insert(audienceContacts).values(
    validContacts.map((ct) => ({
      audienceId,
      contactId: ct.id,
      addedAt: nowStr,
    }))
  );

  // ブロードキャスト作成
  const broadcastId = generateId("bcast");

  await db.insert(broadcasts).values({
    id: broadcastId,
    orgId: auth.orgId,
    audienceId,
    templateId: tmpl.id,
    fromAddressId: addr.id,
    fromAddress: fromAddr,
    subject: renderedSubject,
    variables: variables || null,
    status: "sending",
    totalCount: validContacts.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: nowStr,
  });

  // 非同期で送信開始
  processBroadcast(
    auth.orgId,
    broadcastId,
    audienceId,
    {
      id: tmpl.id,
      subject: tmpl.subject,
      bodyHtml: tmpl.bodyHtml,
      bodyText: tmpl.bodyText,
      category: tmpl.category,
    },
    fromAddr,
    variables || {}
  ).catch((err) => {
    console.error(`Compose broadcast ${broadcastId} failed:`, err);
  });

  return c.json({
    data: {
      id: broadcastId,
      status: "sending",
      totalCount: validContacts.length,
      subject: renderedSubject,
    },
  }, 201);
});

export default app;
