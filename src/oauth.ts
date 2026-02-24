import { canvasOAuthEnabled, config } from "./config.js";
import { fetchJson, formUrlEncoded } from "./http.js";
import { getOAuthToken, upsertOAuthToken } from "./repositories.js";
import type { Provider } from "./types.js";

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
}

function expiresAtFromSeconds(expiresIn?: number): string | null {
  if (!expiresIn) {
    return null;
  }
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  return expiresAt.toISOString();
}

export async function exchangeCanvasCode(code: string, redirectUri: string): Promise<void> {
  if (!canvasOAuthEnabled) {
    throw new Error("Canvas OAuth is not configured. Use CANVAS_ACCESS_TOKEN or set client credentials.");
  }

  const payload = await fetchJson<OAuthTokenResponse>(`${config.canvasBaseUrl}/login/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formUrlEncoded({
      grant_type: "authorization_code",
      client_id: config.canvasClientId!,
      client_secret: config.canvasClientSecret!,
      redirect_uri: redirectUri,
      code,
    }),
  });

  await upsertOAuthToken({
    provider: "canvas",
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type,
    scope: payload.scope,
    expires_at: expiresAtFromSeconds(payload.expires_in),
  });
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<void> {
  const payload = await fetchJson<OAuthTokenResponse>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formUrlEncoded({
      grant_type: "authorization_code",
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  await upsertOAuthToken({
    provider: "google",
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type,
    scope: payload.scope,
    expires_at: expiresAtFromSeconds(payload.expires_in),
  });
}

export async function getValidAccessToken(provider: Provider): Promise<string> {
  if (provider === "canvas" && config.canvasAccessToken) {
    return config.canvasAccessToken;
  }

  const token = await getOAuthToken(provider);
  if (!token) {
    throw new Error(`No ${provider} token found. Connect ${provider} first.`);
  }

  if (!token.expires_at) {
    return token.access_token;
  }

  const expiresAt = new Date(token.expires_at).getTime();
  const now = Date.now();
  const skewMs = 60_000;

  if (expiresAt > now + skewMs) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    throw new Error(`${provider} token expired and no refresh token is available.`);
  }

  const refreshed = await refreshProviderToken(provider, token.refresh_token);

  await upsertOAuthToken({
    provider,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? token.refresh_token,
    token_type: refreshed.token_type,
    scope: refreshed.scope,
    expires_at: expiresAtFromSeconds(refreshed.expires_in),
  });

  return refreshed.access_token;
}

async function refreshProviderToken(
  provider: Provider,
  refreshToken: string,
): Promise<OAuthTokenResponse> {
  if (provider === "canvas") {
    if (!canvasOAuthEnabled) {
      throw new Error("Canvas OAuth refresh is unavailable because Canvas client credentials are not set.");
    }
    return fetchJson<OAuthTokenResponse>(`${config.canvasBaseUrl}/login/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formUrlEncoded({
        grant_type: "refresh_token",
        client_id: config.canvasClientId!,
        client_secret: config.canvasClientSecret!,
        refresh_token: refreshToken,
      }),
    });
  }

  return fetchJson<OAuthTokenResponse>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formUrlEncoded({
      grant_type: "refresh_token",
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: refreshToken,
    }),
  });
}
