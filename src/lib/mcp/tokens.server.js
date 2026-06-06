import "server-only";

import { createHash, randomBytes } from "crypto";

export function hashMcpToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateMcpToken() {
  const raw = randomBytes(32).toString("base64url");
  const token = `mcp_${raw}`;
  return {
    token,
    tokenHash: hashMcpToken(token),
    tokenPrefix: token.slice(0, 12),
  };
}
