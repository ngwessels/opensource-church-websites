import { Suspense } from "react";

import { PublicPageClient } from "../PublicPageClient";
import { PublicSite } from "@/components/site/PublicSite";
import {
  getHiddenPagesServer,
  getNavNodesServer,
  getPageBySlugServer,
  getSiteConfigServer,
  listBulletinsServer,
} from "@/lib/firestore/server";
import { getPageType } from "@/lib/bulletins/schema";
import {
  filterNavTreeForPublic,
  filterQuickLinksForPublic,
  filterSiteConfigForPublic,
  isPageHidden,
} from "@/lib/pages/visibility";
import { buildNavTree, sortQuickLinks } from "@/lib/sitemap/tree";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export async function generateMetadata({ params }) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join("/") || "";

  if (!isFirebaseAdminConfigured()) {
    return { title: "Parish Website" };
  }

  const page = await getPageBySlugServer(slug);
  if (isPageHidden(page)) {
    return { title: "Page not found" };
  }
  const site = await getSiteConfigServer();
  const faviconUrl = site?.seo?.faviconUrl;
  return {
    title: page?.seo?.title || page?.title || site?.name || "Parish",
    description: page?.seo?.description || site?.seo?.description,
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
  };
}

export default async function PublicPage({ params, searchParams }) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join("/") || "";
  const { designPreview } = await searchParams;

  if (designPreview === "1" || !isFirebaseAdminConfigured()) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading…</div>
        }
      >
        <PublicPageClient slug={slug} />
      </Suspense>
    );
  }

  const [siteConfig, nodes, page, { pageIds: hiddenPageIds, slugs: hiddenSlugs }] =
    await Promise.all([
      getSiteConfigServer(),
      getNavNodesServer(),
      getPageBySlugServer(slug),
      getHiddenPagesServer(),
    ]);

  if (!page || isPageHidden(page)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-zinc-500">
          <a href="/login" className="text-blue-600 underline">Sign in</a> to create pages.
        </p>
      </div>
    );
  }

  const navTree = filterNavTreeForPublic(buildNavTree(nodes), hiddenPageIds);
  const quickLinks = filterQuickLinksForPublic(sortQuickLinks(nodes), hiddenPageIds);
  const bulletins =
    getPageType(page) === "bulletins" ? await listBulletinsServer() : [];

  return (
    <PublicSite
      siteConfig={filterSiteConfigForPublic(siteConfig, hiddenSlugs)}
      navTree={navTree}
      navNodes={nodes}
      quickLinks={quickLinks}
      hiddenPageIds={hiddenPageIds}
      page={page}
      pageId={page.id}
      bulletins={bulletins}
    />
  );
}
