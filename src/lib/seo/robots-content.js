import "server-only";

import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getRobotsDisallowPaths } from "@/lib/seo/public-pages";
import { formatReadableHtml } from "@/lib/seo/readable-html";
import { getSiteBaseUrlServer } from "@/lib/seo/site-url.server";

export const BUILDER_DISALLOW = [
  "/builder/",
  "/dashboard/",
  "/login",
  "/signup",
  "/oauth/",
  "/api/",
];

/**
 * @param {string} baseUrl
 * @param {string[]} disallow
 */
export function formatRobotsTxt(baseUrl, disallow) {
  return [
    "User-Agent: *",
    "Allow: /",
    ...disallow.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join("\n");
}

/** @returns {Promise<string>} */
export async function getRobotsTxtContent() {
  const baseUrl = await getSiteBaseUrlServer();

  if (!isFirebaseAdminConfigured()) {
    return formatRobotsTxt(baseUrl, BUILDER_DISALLOW);
  }

  const disallow = [...new Set([...BUILDER_DISALLOW, ...(await getRobotsDisallowPaths())])];
  return formatRobotsTxt(baseUrl, disallow);
}

/**
 * @param {string} body
 */
export function formatRobotsHtml(body) {
  return formatReadableHtml("robots.txt", body);
}
