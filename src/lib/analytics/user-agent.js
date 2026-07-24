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
 * Parse Sec-CH-UA style brand list, e.g.
 * `"Chromium";v="120", "Google Chrome";v="120", "Not.A/Brand";v="99"`
 *
 * @param {string | null | undefined} secChUa
 * @returns {string | undefined}
 */
export function browserFromClientHints(secChUa) {
  if (!secChUa || typeof secChUa !== "string") return undefined;
  const brands = [...secChUa.matchAll(/"([^"]+)";v="([^"]+)"/gi)].map((match) =>
    match[1].toLowerCase(),
  );
  if (brands.some((brand) => brand.includes("opera") || brand === "opr")) return "Opera";
  if (brands.some((brand) => brand.includes("edge"))) return "Edge";
  if (brands.some((brand) => brand.includes("google chrome") || brand === "chrome")) {
    return "Chrome";
  }
  if (brands.some((brand) => brand.includes("microsoft edge"))) return "Edge";
  if (brands.some((brand) => brand.includes("brave"))) return "Brave";
  if (brands.some((brand) => brand.includes("samsung"))) return "Samsung Internet";
  if (brands.some((brand) => brand.includes("firefox"))) return "Firefox";
  if (brands.some((brand) => brand.includes("safari"))) return "Safari";
  if (brands.some((brand) => brand.includes("chromium"))) return "Chrome";
  return undefined;
}

/**
 * @param {string | null | undefined} userAgent
 * @param {{ secChUa?: string | null }} [hints]
 * @returns {ParsedUserAgent}
 */
export function parseUserAgent(userAgent, hints = {}) {
  const ua = typeof userAgent === "string" ? userAgent : "";

  let deviceType = "desktop";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
    deviceType = "tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone|crios|fxios|edgios/i.test(ua)) {
    deviceType = "mobile";
  }

  let browser = "Unknown";
  if (/edg\/|edga\/|edgios\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser\//i.test(ua)) browser = "Samsung Internet";
  else if (/firefox\/|fxios\//i.test(ua)) browser = "Firefox";
  else if (/crios\//i.test(ua)) browser = "Chrome";
  else if (/chrome\//i.test(ua) || /chromium\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua)) browser = "Safari";
  else if (/msie|trident/i.test(ua)) browser = "IE";

  if (browser === "Unknown") {
    const fromHints = browserFromClientHints(hints.secChUa);
    if (fromHints) browser = fromHints;
  }

  let os = "Unknown";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/cros/i.test(ua)) os = "Chrome OS";
  else if (/linux/i.test(ua)) os = "Linux";

  // Client Hints reduced UAs can omit useful tokens; if we still look like a phone
  // viewport bucket from classic mobile tokens above, keep that. When UA is empty
  // but Sec-CH-UA identified a browser, leave device as desktop unless mobile tokens exist.
  return { deviceType, browser, os };
}
