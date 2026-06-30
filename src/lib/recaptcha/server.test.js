import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  assertRecaptchaOrSkip,
  isRecaptchaConfigured,
  verifyRecaptchaToken,
} from "./verify.js";

describe("recaptcha/server", () => {
  const prevSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const prevSecretKey = process.env.RECAPTCHA_SECRET_KEY;
  const prevThreshold = process.env.RECAPTCHA_SCORE_THRESHOLD;
  /** @type {import("node:test").Mock<typeof fetch> | null} */
  let fetchMock = null;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "test-site-key";
    process.env.RECAPTCHA_SECRET_KEY = "test-secret-key";
    delete process.env.RECAPTCHA_SCORE_THRESHOLD;
  });

  afterEach(() => {
    if (prevSiteKey === undefined) delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    else process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = prevSiteKey;
    if (prevSecretKey === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
    else process.env.RECAPTCHA_SECRET_KEY = prevSecretKey;
    if (prevThreshold === undefined) delete process.env.RECAPTCHA_SCORE_THRESHOLD;
    else process.env.RECAPTCHA_SCORE_THRESHOLD = prevThreshold;
    if (fetchMock) {
      mock.restoreAll();
      fetchMock = null;
    }
  });

  function mockSiteverifyResponse(body) {
    fetchMock = mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => body,
    }));
  }

  it("isRecaptchaConfigured is true when both keys are set", () => {
    assert.equal(isRecaptchaConfigured(), true);
  });

  it("isRecaptchaConfigured is false when secret is missing", () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    assert.equal(isRecaptchaConfigured(), false);
  });

  it("verifyRecaptchaToken passes when score and action match", async () => {
    mockSiteverifyResponse({
      success: true,
      score: 0.9,
      action: "donation_checkout",
    });

    const result = await verifyRecaptchaToken("token-123", "donation_checkout");
    assert.equal(result.ok, true);
    assert.equal(result.score, 0.9);
  });

  it("verifyRecaptchaToken fails when score is below threshold", async () => {
    mockSiteverifyResponse({
      success: true,
      score: 0.2,
      action: "form_submit",
    });

    const result = await verifyRecaptchaToken("token-123", "form_submit");
    assert.equal(result.ok, false);
  });

  it("verifyRecaptchaToken fails when action does not match", async () => {
    mockSiteverifyResponse({
      success: true,
      score: 0.9,
      action: "wrong_action",
    });

    const result = await verifyRecaptchaToken("token-123", "form_submit");
    assert.equal(result.ok, false);
  });

  it("assertRecaptchaOrSkip skips when not configured", async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    const result = await assertRecaptchaOrSkip({
      token: "",
      expectedAction: "form_submit",
    });
    assert.deepEqual(result, { ok: true });
  });

  it("assertRecaptchaOrSkip returns generic error when token fails", async () => {
    mockSiteverifyResponse({
      success: true,
      score: 0.1,
      action: "donation_checkout",
    });

    const result = await assertRecaptchaOrSkip({
      token: "bad-token",
      expectedAction: "donation_checkout",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
      assert.match(result.error, /Unable to verify submission/);
    }
  });
});
