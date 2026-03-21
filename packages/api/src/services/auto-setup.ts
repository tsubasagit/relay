import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  organizations,
  orgMembers,
  emailProviders,
  sendingAddresses,
  templates,
} from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { encrypt } from "../utils/crypto.js";

/** テンプレートプリセット定義 */
interface TemplatePreset {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
  category: "transactional" | "marketing";
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    name: "ニュースレター",
    subject: "{{title}}",
    bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#333;">
  <h1 style="font-size:24px;color:#1a1a1a;border-bottom:2px solid #4f46e5;padding-bottom:12px;">{{title}}</h1>
  <div style="font-size:15px;line-height:1.8;color:#555;margin:20px 0;">{{content}}</div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
  <p style="font-size:12px;color:#9ca3af;">このメールは {{sender_name}} からお送りしています。</p>
</div>`,
    bodyText: `{{title}}\n\n{{content}}\n\n---\nこのメールは {{sender_name}} からお送りしています。`,
    variables: ["title", "content", "sender_name"],
    category: "marketing",
  },
  {
    name: "お知らせ・案内",
    subject: "【お知らせ】{{title}}",
    bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#333;">
  <div style="background:#4f46e5;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="font-size:20px;margin:0;">{{title}}</h1>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:15px;line-height:1.8;color:#555;">{{name}} 様</p>
    <p style="font-size:15px;line-height:1.8;color:#555;">いつもご利用いただきありがとうございます。</p>
    <div style="font-size:15px;line-height:1.8;color:#555;margin:16px 0;">{{content}}</div>
    <p style="font-size:15px;line-height:1.8;color:#555;">ご不明な点がございましたら、お気軽にお問い合わせください。</p>
    <p style="font-size:15px;color:#555;margin-top:24px;">{{sender_name}}</p>
  </div>
</div>`,
    bodyText: `【お知らせ】{{title}}\n\n{{name}} 様\n\nいつもご利用いただきありがとうございます。\n\n{{content}}\n\nご不明な点がございましたら、お気軽にお問い合わせください。\n\n{{sender_name}}`,
    variables: ["title", "name", "content", "sender_name"],
    category: "marketing",
  },
  {
    name: "セミナー・イベント案内",
    subject: "【ご招待】{{event_name}}のご案内",
    bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#333;">
  <div style="text-align:center;padding:32px 24px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px 8px 0 0;">
    <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0 0 8px;">EVENT</p>
    <h1 style="font-size:22px;color:#fff;margin:0;">{{event_name}}</h1>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
    <p style="font-size:15px;line-height:1.8;color:#555;">{{name}} 様</p>
    <p style="font-size:15px;line-height:1.8;color:#555;">下記のイベントにご招待いたします。</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">
      <tr><td style="padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:bold;width:100px;font-size:14px;">日時</td><td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:14px;">{{event_date}}</td></tr>
      <tr><td style="padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:bold;font-size:14px;">会場</td><td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:14px;">{{event_location}}</td></tr>
      <tr><td style="padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:bold;font-size:14px;">参加費</td><td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:14px;">{{event_price}}</td></tr>
    </table>
    <div style="font-size:15px;line-height:1.8;color:#555;">{{content}}</div>
    <div style="text-align:center;margin:28px 0;">
      <a href="{{event_url}}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">参加申し込み</a>
    </div>
  </div>
  <div style="padding:16px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#f9fafb;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">{{sender_name}}</p>
  </div>
</div>`,
    bodyText: `【ご招待】{{event_name}}のご案内\n\n{{name}} 様\n\n下記のイベントにご招待いたします。\n\n■ 日時: {{event_date}}\n■ 会場: {{event_location}}\n■ 参加費: {{event_price}}\n\n{{content}}\n\n▼ 参加申し込み\n{{event_url}}\n\n{{sender_name}}`,
    variables: ["event_name", "name", "event_date", "event_location", "event_price", "content", "event_url", "sender_name"],
    category: "marketing",
  },
  {
    name: "お礼メール",
    subject: "{{occasion}}ありがとうございました",
    bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#333;">
  <div style="padding:24px;">
    <h1 style="font-size:20px;color:#1a1a1a;">{{occasion}}ありがとうございました</h1>
    <p style="font-size:15px;line-height:1.8;color:#555;">{{name}} 様</p>
    <div style="font-size:15px;line-height:1.8;color:#555;margin:16px 0;">{{content}}</div>
    <p style="font-size:15px;line-height:1.8;color:#555;">今後とも何卒よろしくお願いいたします。</p>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#555;margin:0;">{{sender_name}}</p>
      <p style="font-size:13px;color:#9ca3af;margin:4px 0 0;">{{sender_email}}</p>
    </div>
  </div>
</div>`,
    bodyText: `{{occasion}}ありがとうございました\n\n{{name}} 様\n\n{{content}}\n\n今後とも何卒よろしくお願いいたします。\n\n{{sender_name}}\n{{sender_email}}`,
    variables: ["occasion", "name", "content", "sender_name", "sender_email"],
    category: "transactional",
  },
  {
    name: "キャンペーン告知",
    subject: "{{campaign_title}}",
    bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:'Hiragino Sans','Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#333;">
  <div style="background:#fef3c7;padding:12px 24px;border-radius:8px 8px 0 0;text-align:center;">
    <p style="font-size:13px;color:#92400e;font-weight:bold;margin:0;">{{campaign_badge}}</p>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;">
    <h1 style="font-size:22px;color:#1a1a1a;text-align:center;margin:0 0 16px;">{{campaign_title}}</h1>
    <p style="font-size:15px;line-height:1.8;color:#555;text-align:center;">{{campaign_subtitle}}</p>
    <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:28px;font-weight:bold;color:#4f46e5;margin:0;">{{discount}}</p>
      <p style="font-size:13px;color:#6b7280;margin:8px 0 0;">期間: {{period}}</p>
    </div>
    <div style="font-size:15px;line-height:1.8;color:#555;margin:16px 0;">{{content}}</div>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{campaign_url}}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 40px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">詳しく見る</a>
    </div>
  </div>
  <div style="padding:16px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#f9fafb;text-align:center;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">{{sender_name}} | このメールは {{sender_name}} の配信リストに登録されている方にお送りしています。</p>
  </div>
</div>`,
    bodyText: `{{campaign_badge}}\n\n{{campaign_title}}\n{{campaign_subtitle}}\n\n{{discount}}\n期間: {{period}}\n\n{{content}}\n\n▼ 詳しく見る\n{{campaign_url}}\n\n{{sender_name}}`,
    variables: ["campaign_badge", "campaign_title", "campaign_subtitle", "discount", "period", "content", "campaign_url", "sender_name"],
    category: "marketing",
  },
];

/**
 * 初回ログイン時の自動セットアップ。
 * ユーザーに組織がなければ、組織・プロバイダー・送信アドレス・テンプレートを自動作成。
 */
export async function autoSetup(userId: string, email: string, name: string): Promise<void> {
  // ユーザーが既に組織に所属しているか確認
  const existingMemberships = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);

  if (existingMemberships.length > 0) {
    return; // 既に組織あり — スキップ
  }

  const now = new Date().toISOString();

  // 1. 組織を自動作成
  const orgId = generateId("org");
  const slug = email.split("@")[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  await db.insert(organizations).values({
    id: orgId,
    name: `${name} のチーム`,
    slug: `${slug}-${Date.now().toString(36)}`,
    plan: "free",
    createdAt: now,
  });

  // メンバーとして追加（admin）
  await db.insert(orgMembers).values({
    id: generateId("mem"),
    orgId,
    userId,
    role: "admin",
    joinedAt: now,
  });

  // 2. Gmail OAuth プロバイダーを自動作成
  const providerConfig = JSON.stringify({ email, userId });
  const providerId = generateId("prov");

  await db.insert(emailProviders).values({
    id: providerId,
    orgId,
    name: "Gmail",
    type: "gmail-oauth",
    config: encrypt(providerConfig),
    isDefault: true,
    createdAt: now,
  });

  // 3. 送信アドレスをユーザーの Gmail で自動作成（domainId = null）
  await db.insert(sendingAddresses).values({
    id: generateId("addr"),
    orgId,
    domainId: null,
    address: email,
    displayName: name,
    createdAt: now,
  });

  // 4. テンプレートプリセットを作成
  for (const preset of TEMPLATE_PRESETS) {
    await db.insert(templates).values({
      id: generateId("tmpl"),
      orgId,
      name: preset.name,
      subject: preset.subject,
      bodyHtml: preset.bodyHtml,
      bodyText: preset.bodyText,
      variables: preset.variables as unknown as string[],
      category: preset.category,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}
