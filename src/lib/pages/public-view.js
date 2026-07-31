import "server-only";

import {
  getCachedBulletins,
  getCachedHiddenPages,
  getCachedNavNodes,
  getCachedPageBySlug,
  getCachedSiteConfig,
} from "@/lib/cache/public-site-data";
import { getPageType } from "@/lib/bulletins/schema";
import { prefetchPageCalendarEvents } from "@/lib/calendar/prefetch";
import {
  isPagePasswordProtected,
  stripPasswordHash,
} from "@/lib/pages/password-status";
import {
  asHiddenPageSets,
  filterNavTreeForPublic,
  filterQuickLinksForPublic,
  filterSiteConfigForPublic,
  isPageHidden,
} from "@/lib/pages/visibility";
import { resolvePublishedPageView } from "@/lib/pages/publish";
import { buildNavTree, sortQuickLinks } from "@/lib/sitemap/tree";

/**
 * Build PublicSite props for a published slug, or an error status.
 * Does not check unlock cookies — callers must enforce password access.
 *
 * @param {string} slug
 * @returns {Promise<
 *   | { ok: true, pageId: string, props: object }
 *   | { ok: false, status: 404 | 403, error: string, pageId?: string, pageTitle?: string }
 * >}
 */
export async function loadPublicSiteView(slug) {
  const normalized = slug || "";
  const [siteConfig, nodes, page, hiddenPagesCached] = await Promise.all([
    getCachedSiteConfig(),
    getCachedNavNodes(),
    getCachedPageBySlug(normalized),
    getCachedHiddenPages(),
  ]);
  const { pageIds: hiddenPageIds, slugs: hiddenSlugs } = asHiddenPageSets(hiddenPagesCached);

  const publicPage = resolvePublishedPageView(page);
  if (!publicPage || isPageHidden(publicPage)) {
    return { ok: false, status: 404, error: "Page not found" };
  }

  const navTree = filterNavTreeForPublic(buildNavTree(nodes), hiddenPageIds);
  const quickLinks = filterQuickLinksForPublic(sortQuickLinks(nodes), hiddenPageIds);
  const safePage = stripPasswordHash(publicPage);
  const [bulletins, calendarEventsByModuleId] = await Promise.all([
    getPageType(safePage) === "bulletins" ? getCachedBulletins() : Promise.resolve([]),
    prefetchPageCalendarEvents(safePage, siteConfig?.timezone),
  ]);

  return {
    ok: true,
    pageId: page.id,
    passwordProtected: isPagePasswordProtected(page),
    pageTitle: publicPage.title,
    props: {
      siteConfig: filterSiteConfigForPublic(siteConfig, hiddenSlugs),
      navTree,
      navNodes: nodes,
      quickLinks,
      page: safePage,
      pageId: page.id,
      bulletins,
      calendarEventsByModuleId,
    },
  };
}
