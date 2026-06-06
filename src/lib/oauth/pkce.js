import "server-only";

import { createHash } from "crypto";

export function verifyPkceS256(codeVerifier, codeChallenge) {
  if (!codeVerifier || !codeChallenge) return false;
  const digest = createHash("sha256").update(codeVerifier).digest("base64url");
  return digest === codeChallenge;
}

export function isValidCodeChallengeMethod(method) {
  return method === "S256";
}
