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
  const token = Buffer.from(`${orgId}:${email}`).toString("base64url");
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
