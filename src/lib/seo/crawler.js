const CRAWLER_UA =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|applebot|linkedinbot|discordbot|semrushbot|ahrefsbot|mj12bot|rogerbot|embedly|whatsapp|chrome-lighthouse|petalbot|bytespider/i;

/**
 * @param {string | null | undefined} userAgent
 */
export function isCrawlerUserAgent(userAgent) {
  return CRAWLER_UA.test(userAgent || "");
}
