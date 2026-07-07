/**
 * Build Next.js metadata icons from site SEO config.
 * Uses a fresh Firestore read so favicon updates are not blocked by stale cache.
 *
 * @param {import("@/types/firestore").SiteSeo | null | undefined} seo
 * @returns {import("next").Metadata["icons"] | undefined}
 */
export function buildSiteIconsMetadata(seo) {
  const faviconUrl = seo?.faviconUrl?.trim();
  if (!faviconUrl) return undefined;

  const type = faviconTypeFromUrl(faviconUrl);
  return {
    icon: type ? [{ url: faviconUrl, type }] : faviconUrl,
  };
}

/** @param {string} url */
function faviconTypeFromUrl(url) {
  const path = url.split("?")[0]?.toLowerCase() || "";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".bmp")) return "image/bmp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return undefined;
}
