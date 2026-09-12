import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Mailgun signatures older than this are rejected as replays. */
export const MAILGUN_SIGNATURE_MAX_AGE_SECONDS = 15 * 60;

/**
 * Constant-time string comparison that tolerates differing lengths.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeCompare(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Secret embedded in the webhook URL we register with Mailgun. It authenticates
 * inbound calls when the operator has not supplied an HTTP signing key.
 *
 * @returns {string}
 */
export function generateWebhookSecret() {
  return randomBytes(24).toString("hex");
}

/**
 * Verify Mailgun's `signature` block:
 * `HMAC-SHA256(signing key, timestamp + token)`.
 *
 * @param {{ timestamp?: unknown, token?: unknown, signature?: unknown } | null | undefined} signature
 * @param {string} signingKey
 * @param {{ nowSeconds?: number }} [options]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function verifyMailgunSignature(signature, signingKey, options = {}) {
  if (!signingKey) {
    return { ok: false, error: "No Mailgun webhook signing key configured." };
  }

  const timestamp = typeof signature?.timestamp === "string" || typeof signature?.timestamp === "number"
    ? String(signature.timestamp)
    : "";
  const token = typeof signature?.token === "string" ? signature.token : "";
  const provided = typeof signature?.signature === "string" ? signature.signature : "";

  if (!timestamp || !token || !provided) {
    return { ok: false, error: "Mailgun signature block is incomplete." };
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const age = nowSeconds - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > MAILGUN_SIGNATURE_MAX_AGE_SECONDS) {
    return { ok: false, error: "Mailgun signature timestamp is outside the accepted window." };
  }

  const expected = createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");

  return timingSafeCompare(expected, provided)
    ? { ok: true }
    : { ok: false, error: "Mailgun signature did not match." };
}
