/**
 * Extract client IP and coarse geolocation from common hosting/CDN request headers.
 * Values are best-effort: local dev and some proxies may omit them.
 */

/**
 * @param {Headers} headers
 */
export function getClientIpFromHeaders(headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "";
}

/**
 * @param {Headers} headers
 */
export function getIpCountryFromHeaders(headers) {
  const country =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("cloudfront-viewer-country") ||
    headers.get("x-appengine-country") ||
    headers.get("x-country-code");

  if (!country || country === "XX" || country === "ZZ" || country === "??") {
    return "";
  }

  return country.slice(0, 2).toUpperCase();
}

/**
 * @param {Headers} headers
 */
export function getIpCityFromHeaders(headers) {
  const raw =
    headers.get("x-vercel-ip-city") ||
    headers.get("cf-ipcity") ||
    headers.get("cloudfront-viewer-city");

  if (!raw) return "";

  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/**
 * @param {Request | { headers: Headers }} request
 * @returns {{ ipAddress: string, ipCountry: string, ipCity: string }}
 */
export function getSubmissionIpGeoFromRequest(request) {
  const headers = request.headers;
  return {
    ipAddress: getClientIpFromHeaders(headers),
    ipCountry: getIpCountryFromHeaders(headers),
    ipCity: getIpCityFromHeaders(headers),
  };
}
