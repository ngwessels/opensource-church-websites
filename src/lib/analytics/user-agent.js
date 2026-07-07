/** @typedef {{ deviceType: 'mobile' | 'tablet' | 'desktop', browser: string, os: string }} ParsedUserAgent */

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|bytespider|gptbot|claudebot/i;

/**
 * @param {string | null | undefined} userAgent
 */
export function isBotUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== "string") return false;
  return BOT_PATTERN.test(userAgent);
}

/**
 * @param {string | null | undefined} userAgent
 * @returns {ParsedUserAgent}
 */
export function parseUserAgent(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent : "";

  let deviceType = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    deviceType = "tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) {
    deviceType = "mobile";
  }

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/msie|trident/i.test(ua)) browser = "IE";

  let os = "Unknown";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua) && !/iphone|ipad/i.test(ua)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  return { deviceType, browser, os };
}
