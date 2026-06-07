import "server-only";

import {
  getHiddenPagesServer,
  getNavNodesServer,
  getPublishedPagesServer,
} from "@/lib/firestore/server";

/**
 * Published, visible CMS pages suitable for search indexing.
 * Excludes hidden pages and nav nodes marked as secure pages.
 *
 * @returns {Promise<Array<{ id: string, slug?: string, updatedAt?: string, publishedAt?: string }>>}
 */
export async function getIndexablePages() {
  const [pages, navNodes] = await Promise.all([getPublishedPagesServer(), getNavNodesServer()]);

  const securePageIds = new Set(
    navNodes.filter((node) => node.type === "secure_page" && node.pageId).map((node) => node.pageId),
  );

  return pages.filter((page) => !securePageIds.has(page.id));
}

/**
 * CMS paths that should not be crawled (hidden or secure pages).
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

  const securePaths = pages
    .filter((page) => securePageIds.has(page.id))
    .map((page) => {
      const slug = page.slug ?? "";
      return slug ? `/${slug.replace(/^\/+|\/+$/g, "")}` : null;
    })
    .filter(Boolean);

  return [...hiddenPaths, ...securePaths];
}
