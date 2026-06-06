/**
 * Normalize and validate embed URLs (HTTPS only).
 * @param {string} url
 * @returns {string|null}
 */
export function normalizeHttpsUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * @param {number|string|undefined} height
 * @param {number} fallback
 */
export function parseEmbedHeight(height, fallback = 400) {
  const n = Number(height);
  if (Number.isFinite(n) && n > 0) return Math.min(n, 2000);
  return fallback;
}

/**
 * Build a Facebook Page Plugin embed URL from a page URL when possible.
 * @param {string} pageUrl
 */
export function facebookEmbedFromPageUrl(pageUrl) {
  const normalized = normalizeHttpsUrl(pageUrl);
  if (!normalized) return "";
  try {
    const u = new URL(normalized);
    if (!u.hostname.includes("facebook.com")) return "";
    return `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(normalized)}&tabs=timeline&width=500&height=500&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`;
  } catch {
    return "";
  }
}

/**
 * Build Instagram embed URL from a post URL when possible.
 * @param {string} postUrl
 */
export function instagramEmbedFromPostUrl(postUrl) {
  const normalized = normalizeHttpsUrl(postUrl);
  if (!normalized) return "";
  const match = normalized.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/i);
  if (!match) return "";
  return `https://www.instagram.com/p/${match[1]}/embed`;
}
