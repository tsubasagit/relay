import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { refreshAccessToken } from "../google-auth.js";
import { config } from "../../config.js";
import type { EmailProvider, SendOptions, GmailOAuthConfig } from "./types.js";

export class GmailOAuthProvider implements EmailProvider {
  private userId: string;
  private email: string;

  constructor(gmailConfig: GmailOAuthConfig) {
    this.userId = gmailConfig.userId;
    this.email = gmailConfig.email;
  }

  async send(options: SendOptions): Promise<void> {
    const [user] = await db
      .select({
        googleAccessToken: users.googleAccessToken,
        googleRefreshToken: users.googleRefreshToken,
      })
      .from(users)
      .where(eq(users.id, this.userId))
      .limit(1);

    if (!user?.googleRefreshToken) {
      throw new Error("Gmail OAuth トークンが見つかりません。再ログインしてください。");
    }

    let accessToken = user.googleAccessToken || "";

    // Refresh the token
    try {
      accessToken = await refreshAccessToken(user.googleRefreshToken);
      await db
        .update(users)
        .set({ googleAccessToken: accessToken })
        .where(eq(users.id, this.userId));
    } catch {
      throw new Error("Gmail OAuth トークンの更新に失敗しました。再ログインしてください。");
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: this.email,
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        refreshToken: user.googleRefreshToken,
        accessToken,
      },
    });

    // Gmail は認証アカウントと異なる from を拒否/書き換えするため、
    // from が認証ユーザーと異なる場合は replyTo に元アドレスを設定
    const requestedFrom = options.from;
    const requestedEmail = requestedFrom.includes("<")
      ? requestedFrom.match(/<(.+)>/)?.[1] || requestedFrom
      : requestedFrom;

    const fromMismatch =
      requestedEmail.toLowerCase() !== this.email.toLowerCase();

    await transporter.sendMail({
      from: fromMismatch ? this.email : options.from,
      replyTo: fromMismatch ? requestedFrom : undefined,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers: options.headers,
    });
  }

  async verify(): Promise<{ success: boolean; error?: string }> {
    try {
      const [user] = await db
        .select({
          googleAccessToken: users.googleAccessToken,
          googleRefreshToken: users.googleRefreshToken,
        })
        .from(users)
        .where(eq(users.id, this.userId))
        .limit(1);

      if (!user?.googleRefreshToken) {
        return { success: false, error: "Gmail OAuth トークンが見つかりません" };
      }

      const accessToken = await refreshAccessToken(user.googleRefreshToken);

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          user: this.email,
          clientId: config.googleClientId,
          clientSecret: config.googleClientSecret,
          refreshToken: user.googleRefreshToken,
          accessToken,
        },
      });

      await transporter.verify();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
