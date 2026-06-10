import "server-only";

import { unstable_cache } from "next/cache";

import {
  getHiddenPagesServer,
  getNavNodesServer,
  getPageBySlugServer,
  getPublishedPagesServer,
  getSiteConfigServer,
  listBulletinsServer,
} from "@/lib/firestore/server";

import { PUBLIC_CACHE_TAGS } from "./tags";

export const getCachedSiteConfig = unstable_cache(
  async () => getSiteConfigServer(),
  ["public-site-config"],
  { tags: [PUBLIC_CACHE_TAGS.siteConfig] },
);

export const getCachedNavNodes = unstable_cache(
  async () => getNavNodesServer(),
  ["public-nav-nodes"],
  { tags: [PUBLIC_CACHE_TAGS.nav] },
);

export const getCachedHiddenPages = unstable_cache(
  async () => getHiddenPagesServer(),
  ["public-hidden-pages"],
  { tags: [PUBLIC_CACHE_TAGS.hiddenPages] },
);

export const getCachedBulletins = unstable_cache(
  async () => listBulletinsServer(),
  ["public-bulletins"],
  { tags: [PUBLIC_CACHE_TAGS.bulletins] },
);

export function getCachedPageBySlug(slug) {
  const normalized = slug || "";
  return unstable_cache(
    async () => getPageBySlugServer(normalized),
    ["public-page-by-slug", normalized],
    { tags: [PUBLIC_CACHE_TAGS.page(normalized)] },
  )();
}

export const getCachedPublishedPageSlugs = unstable_cache(
  async () => {
    const pages = await getPublishedPagesServer();
    return pages.map((page) => page.slug ?? "");
  },
  ["public-published-page-slugs"],
  { tags: [PUBLIC_CACHE_TAGS.nav, PUBLIC_CACHE_TAGS.hiddenPages] },
);
