/**
 * Resolve the public site origin for sitemap, robots, and canonical URLs.
 * Prefers Firestore canonicalDomain, then NEXT_PUBLIC_SITE_URL.
 *
 * @param {object | null | undefined} [siteConfig]
 */
function normalizeUrlCandidate(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getSiteBaseUrl(siteConfig) {
  const raw =
    siteConfig?.canonicalDomain?.trim() ||
    normalizeUrlCandidate(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeUrlCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
    "";

  if (!raw) {
    const fallback =
      normalizeUrlCandidate(process.env.NEXT_PUBLIC_SITE_URL) ||
      normalizeUrlCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
      "http://localhost:3000";
    return fallback.replace(/\/+$/, "");
  }
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return `https://${raw.replace(/\/+$/, "")}`;
}

/** App routes that are public but outside the CMS catch-all. */
export const STATIC_INDEXABLE_PATHS = ["/give"];

/**
 * @param {string} baseUrl
 * @param {string} [slug]
 */
export function pageUrlFromSlug(baseUrl, slug) {
  const path = (slug ?? "").replace(/^\/+|\/+$/g, "");
  return path ? `${baseUrl}/${path}` : baseUrl;
}

/**
 * @param {string} baseUrl
 * @param {Array<{ slug?: string, updatedAt?: string, publishedAt?: string }>} pages
 */
export function buildSitemapEntries(baseUrl, pages) {
  const cmsEntries = pages.map((page) => ({
    url: pageUrlFromSlug(baseUrl, page.slug),
    lastModified: page.publishedAt || page.updatedAt || new Date().toISOString(),
    changeFrequency: "weekly",
    priority: page.slug === "" || page.slug === undefined ? 1 : 0.8,
  }));

  const staticEntries = STATIC_INDEXABLE_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const seen = new Set();
  return [...cmsEntries, ...staticEntries].filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}

/**
 * @param {string} value
 */
function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * @param {Array<{ url: string, lastModified?: string, changeFrequency?: string, priority?: number }>} entries
 */
export function formatSitemapXml(entries) {
  const urls = entries
    .map((entry) => {
      const lines = [`    <loc>${escapeXml(entry.url)}</loc>`];
      if (entry.lastModified) {
        lines.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
      }
      if (entry.changeFrequency) {
        lines.push(`    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`);
      }
      if (entry.priority !== undefined && entry.priority !== null) {
        lines.push(`    <priority>${entry.priority}</priority>`);
      }
      return `  <url>\n${lines.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
