import "server-only";

import {
  getHiddenPagesServer,
  getNavNodesServer,
  getPublishedPagesServer,
} from "@/lib/firestore/server";
import { isPagePasswordProtected } from "@/lib/pages/password-status";

function pathForSlug(slug) {
  const normalized = (slug ?? "").replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : null;
}

/**
 * Published, visible CMS pages suitable for search indexing.
 * Excludes hidden pages, password-protected pages, and nav nodes marked as secure pages.
 *
 * @returns {Promise<Array<{ id: string, slug?: string, updatedAt?: string, publishedAt?: string }>}
 */
export async function getIndexablePages() {
  const [pages, navNodes] = await Promise.all([getPublishedPagesServer(), getNavNodesServer()]);

  const securePageIds = new Set(
    navNodes.filter((node) => node.type === "secure_page" && node.pageId).map((node) => node.pageId),
  );

  return pages.filter(
    (page) => !securePageIds.has(page.id) && !isPagePasswordProtected(page),
  );
}

/**
 * CMS paths that should not be crawled (hidden, secure, or password-protected pages).
 *
 * @returns {Promise<string[]>}
 */
export async function getRobotsDisallowPaths() {
  const [pages, navNodes, { slugs: hiddenSlugs }] = await Promise.all([
    getPublishedPagesServer(),
    getNavNodesServer(),
    getHiddenPagesServer(),
  ]);

  const securePageIds = new Set(
    navNodes.filter((node) => node.type === "secure_page" && node.pageId).map((node) => node.pageId),
  );

  const hiddenPaths = [...hiddenSlugs]
    .filter((slug) => slug !== undefined && slug !== null && slug !== "")
    .map((slug) => `/${slug.replace(/^\/+|\/+$/g, "")}`);

  const gatedPaths = pages
    .filter((page) => securePageIds.has(page.id) || isPagePasswordProtected(page))
    .map((page) => pathForSlug(page.slug))
    .filter(Boolean);

  return [...new Set([...hiddenPaths, ...gatedPaths])];
}
