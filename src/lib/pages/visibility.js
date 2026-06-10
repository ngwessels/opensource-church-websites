/**
 * Page visibility helpers for public site rendering.
 */

import { isSyncedQuickLinksColumn } from "../sitemap/tree.js";

/** @param {{ hidden?: boolean } | null | undefined} page */
export function isPageHidden(page) {
  return page?.hidden === true;
}

/** @param {{ slug?: string } | null | undefined} page */
export function isHomePage(page) {
  return (page?.slug ?? "") === "";
}

/** @param {{ slug?: string } | null | undefined} page @param {boolean} hidden */
export function wouldHideHomePage(page, hidden) {
  return hidden === true && isHomePage(page);
}

/** @param {Array<{ id?: string, hidden?: boolean, slug?: string }>} pages */
export function getHiddenPageSets(pages) {
  const pageIds = new Set();
  const slugs = new Set();
  for (const page of pages) {
    if (!isPageHidden(page)) continue;
    if (page.id) pageIds.add(page.id);
    if (page.slug !== undefined && page.slug !== null) {
      slugs.add(page.slug);
    }
  }
  return { pageIds, slugs };
}

/** Restore Sets after unstable_cache (JSON cannot preserve Set instances). */
export function asHiddenPageSets(cached) {
  return {
    pageIds:
      cached.pageIds instanceof Set ? cached.pageIds : new Set(cached.pageIds ?? []),
    slugs: cached.slugs instanceof Set ? cached.slugs : new Set(cached.slugs ?? []),
  };
}

/** @param {string} href */
export function normalizeSitePath(href) {
  if (!href || href === "#") return null;
  if (/^https?:\/\//i.test(href)) return null;
  const path = href.startsWith("/") ? href.slice(1) : href;
  return path.replace(/\/+$/, "");
}

/** @param {string} href @param {Set<string>} hiddenSlugs */
export function isHrefHidden(href, hiddenSlugs) {
  const path = normalizeSitePath(href);
  if (path === null) return false;
  return hiddenSlugs.has(path);
}

function isNavNodeHidden(node, hiddenPageIds) {
  return Boolean(node.pageId && hiddenPageIds.has(node.pageId));
}

/**
 * Filter nav tree for public display: hideInNav groups and pages marked hidden.
 * @param {object[]} tree
 * @param {Set<string>} hiddenPageIds
 */
export function filterNavTreeForPublic(tree, hiddenPageIds) {
  return tree
    .filter((node) => !node.hideInNav)
    .map((node) => ({
      ...node,
      children: node.children?.length
        ? filterNavTreeForPublic(node.children, hiddenPageIds)
        : [],
    }))
    .filter((node) => {
      if (isNavNodeHidden(node, hiddenPageIds)) return false;
      if (node.type === "group" && !node.pageId && node.children.length === 0) return false;
      return true;
    });
}

/**
 * @param {object[]} quickLinks
 * @param {Set<string>} hiddenPageIds
 */
export function filterQuickLinksForPublic(quickLinks, hiddenPageIds) {
  return quickLinks.filter((link) => !isNavNodeHidden(link, hiddenPageIds));
}

/**
 * @param {object[]} items
 * @param {Set<string>} hiddenPageIds
 */
export function filterSectionNavItems(items, hiddenPageIds) {
  return items.filter((item) => !isNavNodeHidden(item, hiddenPageIds));
}

/**
 * @param {{ columns?: object[] } | null | undefined} footerConfig
 * @param {Set<string>} hiddenSlugs
 */
export function filterFooterConfigForPublic(footerConfig, hiddenSlugs) {
  if (!footerConfig?.columns?.length) return footerConfig;

  return {
    ...footerConfig,
    columns: footerConfig.columns.map((col) => {
      if (isSyncedQuickLinksColumn(col) || !col.links?.length) return col;
      return {
        ...col,
        links: col.links.filter((link) => !isHrefHidden(link.href, hiddenSlugs)),
      };
    }),
  };
}

/**
 * Apply public visibility filtering to site config footer.
 * @param {object | null | undefined} siteConfig
 * @param {Set<string>} hiddenSlugs
 */
export function filterSiteConfigForPublic(siteConfig, hiddenSlugs) {
  if (!siteConfig) return siteConfig;
  return {
    ...siteConfig,
    footerConfig: filterFooterConfigForPublic(siteConfig.footerConfig, hiddenSlugs),
  };
}
