import "server-only";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getIndexablePages } from "@/lib/seo/public-pages";
import { buildSitemapEntries, formatSitemapXml } from "@/lib/seo/site-url";
import { getSiteBaseUrlServer } from "@/lib/seo/site-url.server";
import { formatReadableHtml } from "@/lib/seo/readable-html";

/** @returns {Promise<Array<{ url: string, lastModified: string, changeFrequency: string, priority: number }>>} */
export async function getSitemapEntries() {
  const baseUrl = await getSiteBaseUrlServer();

  if (!isFirebaseAdminConfigured()) {
    return [
      {
        url: baseUrl,
        lastModified: new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  const pages = await getIndexablePages();
  return buildSitemapEntries(baseUrl, pages);
}

/** @returns {Promise<string>} */
export async function getSitemapXmlContent() {
  const entries = await getSitemapEntries();
  return formatSitemapXml(entries);
}

/**
 * @param {string} body
 */
export function formatSitemapHtml(body) {
  return formatReadableHtml("sitemap.xml", body);
}
