import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";

const client = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  config.googleCallbackUrl
);

export function getAuthUrl(): string {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/directory.readonly",
      "https://mail.google.com/",
    ],
    prompt: "consent",
  });
}

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export async function getGoogleUser(code: string): Promise<GoogleUserInfo> {
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: config.googleClientId,
  });

  const payload = ticket.getPayload()!;

  return {
    googleId: payload.sub,
    email: payload.email!,
    name: payload.name || payload.email!,
    avatarUrl: payload.picture || null,
    accessToken: tokens.access_token || null,
    refreshToken: tokens.refresh_token || null,
  };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return credentials.access_token!;
}
