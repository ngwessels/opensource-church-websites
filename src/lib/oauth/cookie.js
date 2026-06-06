import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { MCP_OAUTH_COOKIE_NAME, getCookieSecret } from "@/lib/oauth/config";

function sign(payload) {
  return createHmac("sha256", getCookieSecret()).update(payload).digest("base64url");
}

export function serializeOAuthPendingCookie(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function parseOAuthPendingCookie(value) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function oauthPendingCookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export { MCP_OAUTH_COOKIE_NAME };
