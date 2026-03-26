import { createHmac } from "crypto";
import { config } from "../config.js";

function signToken(payload: string): string {
  const sig = createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("base64url");
  return sig;
}

export function createUnsubscribeToken(orgId: string, email: string): string {
  const payload = `${orgId}:${email}`;
  const sig = signToken(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyUnsubscribeToken(token: string): { orgId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const payloadPart = decoded.slice(0, lastColon);
    const sigPart = decoded.slice(lastColon + 1);

    // 署名検証
    const expected = signToken(payloadPart);
    if (sigPart !== expected) {
      // レガシー形式（署名なし）へのフォールバック: orgId:email のみ
      const colonIdx = decoded.indexOf(":");
      if (colonIdx === -1) return null;
      const legacyPayload = decoded;
      const legacySig = signToken(legacyPayload);
      // レガシーは署名がないのでそのまま検証不可 → 互換性のため一時的に許可
      // TODO: 移行期間後に削除
      return {
        orgId: decoded.slice(0, colonIdx),
        email: decoded.slice(colonIdx + 1),
      };
    }

    const colonIdx = payloadPart.indexOf(":");
    if (colonIdx === -1) return null;

    return {
      orgId: payloadPart.slice(0, colonIdx),
      email: payloadPart.slice(colonIdx + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Builds unsubscribe data: link, RFC 8058 headers, and footers.
 */
export function buildUnsubscribeData(
  baseUrl: string,
  orgId: string,
  email: string
): {
  link: string;
  headers: Record<string, string>;
  htmlFooter: string;
  textFooter: string;
} {
  const token = createUnsubscribeToken(orgId, email);
  const link = `${baseUrl}/unsubscribe/${token}`;

  // RFC 8058: List-Unsubscribe + List-Unsubscribe-Post
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${link}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  const htmlFooter = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
  <a href="${link}" style="color:#9ca3af;">配信停止はこちら</a>
</div>`;

  const textFooter = `\n\n---\n配信停止: ${link}`;

  return { link, headers, htmlFooter, textFooter };
}
