import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateWebhookSecret, timingSafeCompare, verifyMailgunSignature } from "./signature.js";

const SIGNING_KEY = "test-signing-key";

/**
 * @param {number} timestamp
 * @param {string} token
 */
function sign(timestamp, token) {
  return createHmac("sha256", SIGNING_KEY).update(`${timestamp}${token}`).digest("hex");
}

describe("mailgun/signature", () => {
  it("compares strings without leaking length mismatches", () => {
    assert.equal(timingSafeCompare("abc", "abc"), true);
    assert.equal(timingSafeCompare("abc", "abd"), false);
    assert.equal(timingSafeCompare("abc", "abcd"), false);
    assert.equal(timingSafeCompare("", ""), true);
    assert.equal(timingSafeCompare(undefined, "abc"), false);
  });

  it("generates distinct webhook secrets", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    assert.equal(a.length, 48);
    assert.notEqual(a, b);
  });

  it("accepts a valid signature", () => {
    const timestamp = 1529006854;
    const token = "token-abc";
    const result = verifyMailgunSignature(
      { timestamp: String(timestamp), token, signature: sign(timestamp, token) },
      SIGNING_KEY,
      { nowSeconds: timestamp + 5 },
    );
    assert.equal(result.ok, true);
  });

  it("rejects a tampered signature", () => {
    const timestamp = 1529006854;
    const result = verifyMailgunSignature(
      { timestamp: String(timestamp), token: "token-abc", signature: sign(timestamp, "other-token") },
      SIGNING_KEY,
      { nowSeconds: timestamp },
    );
    assert.equal(result.ok, false);
  });

  it("rejects replayed signatures", () => {
    const timestamp = 1529006854;
    const token = "token-abc";
    const result = verifyMailgunSignature(
      { timestamp: String(timestamp), token, signature: sign(timestamp, token) },
      SIGNING_KEY,
      { nowSeconds: timestamp + 3600 },
    );
    assert.equal(result.ok, false);
  });

  it("rejects incomplete input and a missing signing key", () => {
    assert.equal(verifyMailgunSignature({ timestamp: "1", token: "t" }, SIGNING_KEY).ok, false);
    assert.equal(verifyMailgunSignature(null, SIGNING_KEY).ok, false);
    assert.equal(verifyMailgunSignature({ timestamp: "1", token: "t", signature: "s" }, "").ok, false);
  });
});
