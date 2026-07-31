import { createHmac, timingSafeEqual } from "node:crypto";

export const PAGE_UNLOCK_COOKIE_NAME = "page_unlock";
export const PAGE_UNLOCK_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function getUnlockCookieSecret() {
  const secret = process.env.MCP_OAUTH_COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MCP_OAUTH_COOKIE_SECRET must be set in production");
    }
    return "dev-mcp-oauth-cookie-secret-change-me";
  }
  return secret;
}

function sign(payload) {
  return createHmac("sha256", getUnlockCookieSecret()).update(payload).digest("base64url");
}

/**
 * @param {{ pageIds: string[], exp: number }} data
 */
export function serializePageUnlockCookie(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

/**
 * @param {string | null | undefined} value
 * @returns {{ pageIds: string[], exp: number } | null}
 */
export function parsePageUnlockCookie(value) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || typeof data !== "object") return null;
    if (!Array.isArray(data.pageIds) || typeof data.exp !== "number") return null;
    if (data.exp <= Date.now()) return null;
    const pageIds = data.pageIds.filter((id) => typeof id === "string" && id.length > 0);
    return { pageIds, exp: data.exp };
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} cookieValue
 * @param {string} pageId
 */
export function isPageUnlockedInCookie(cookieValue, pageId) {
  if (!pageId) return false;
  const data = parsePageUnlockCookie(cookieValue);
  if (!data) return false;
  return data.pageIds.includes(pageId);
}

/**
 * @param {string | null | undefined} existingCookieValue
 * @param {string} pageId
 */
export function buildPageUnlockCookieValue(existingCookieValue, pageId) {
  const existing = parsePageUnlockCookie(existingCookieValue);
  const pageIds = new Set(existing?.pageIds ?? []);
  pageIds.add(pageId);
  const exp = Date.now() + PAGE_UNLOCK_MAX_AGE_SECONDS * 1000;
  return serializePageUnlockCookie({ pageIds: [...pageIds], exp });
}

/**
 * @param {number} [maxAgeSeconds]
 */
export function pageUnlockCookieOptions(maxAgeSeconds = PAGE_UNLOCK_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
