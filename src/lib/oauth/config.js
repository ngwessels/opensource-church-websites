import "server-only";

import { getOAuthIssuer, oauthAbsoluteUrl } from "@/lib/oauth/origin";

export { getOAuthIssuer, oauthAbsoluteUrl };

export const MCP_OAUTH_COOKIE_NAME = "mcp_oauth_pending";

export function getMcpResourceUrl() {
  return `${getOAuthIssuer()}/api/mcp`;
}

export function getAccessTokenTtlSeconds() {
  const raw = Number(process.env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS || 3600);
  return Number.isFinite(raw) && raw > 0 ? raw : 3600;
}

export function getAuthCodeTtlSeconds() {
  const raw = Number(process.env.MCP_OAUTH_CODE_TTL_SECONDS || 600);
  return Number.isFinite(raw) && raw > 0 ? raw : 600;
}

export function getCookieSecret() {
  const secret = process.env.MCP_OAUTH_COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MCP_OAUTH_COOKIE_SECRET must be set in production");
    }
    return "dev-mcp-oauth-cookie-secret-change-me";
  }
  return secret;
}
