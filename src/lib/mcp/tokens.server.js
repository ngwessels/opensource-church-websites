import "server-only";

import { createHash, randomBytes } from "crypto";

export function hashMcpToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateOAuthAccessToken() {
  const raw = randomBytes(32).toString("base64url");
  const token = `mcp_oat_${raw}`;
  return {
    token,
    tokenHash: hashMcpToken(token),
    tokenPrefix: token.slice(0, 14),
  };
}
