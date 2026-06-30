const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_SCORE_THRESHOLD = 0.5;
export const RECAPTCHA_GENERIC_ERROR = "Unable to verify submission. Please try again.";

export function isRecaptchaConfigured() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  const secretKey = process.env.RECAPTCHA_SECRET_KEY?.trim();
  return Boolean(siteKey && secretKey);
}

function getScoreThreshold() {
  const raw = process.env.RECAPTCHA_SCORE_THRESHOLD?.trim();
  if (!raw) return DEFAULT_SCORE_THRESHOLD;

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_SCORE_THRESHOLD;
  }

  return parsed;
}

/**
 * @param {string} token
 * @param {string} expectedAction
 * @returns {Promise<{ ok: boolean, score?: number, action?: string, errorCodes?: string[] }>}
 */
export async function verifyRecaptchaToken(token, expectedAction) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secretKey) {
    return { ok: false, errorCodes: ["missing-secret"] };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return { ok: false, errorCodes: ["missing-token"] };
  }

  const response = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: secretKey,
      response: token.trim(),
    }),
  });

  if (!response.ok) {
    return { ok: false, errorCodes: ["siteverify-http-error"] };
  }

  const data = await response.json();
  const score = typeof data.score === "number" ? data.score : undefined;
  const action = typeof data.action === "string" ? data.action : undefined;
  const threshold = getScoreThreshold();

  const ok =
    data.success === true &&
    action === expectedAction &&
    typeof score === "number" &&
    score >= threshold;

  return {
    ok,
    score,
    action,
    errorCodes: Array.isArray(data["error-codes"]) ? data["error-codes"] : undefined,
  };
}

/**
 * @param {{ token?: unknown, expectedAction: string }}
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
export async function assertRecaptchaOrSkip({ token, expectedAction }) {
  if (!isRecaptchaConfigured()) {
    return { ok: true };
  }

  const tokenValue = typeof token === "string" ? token : "";
  const result = await verifyRecaptchaToken(tokenValue, expectedAction);

  if (!result.ok) {
    console.warn("[recaptcha] Verification failed", {
      action: expectedAction,
      score: result.score,
      returnedAction: result.action,
      errorCodes: result.errorCodes,
    });
    return { ok: false, status: 403, error: RECAPTCHA_GENERIC_ERROR };
  }

  return { ok: true };
}
