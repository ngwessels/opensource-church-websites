import { cookies } from "next/headers";

import { DesignPreviewGate } from "../DesignPreviewGate";
import { PasswordGate } from "@/components/site/PasswordGate";
import { PublicSite } from "@/components/site/PublicSite";
import {
  getCachedBulletins,
  getCachedHiddenPages,
  getCachedNavNodes,
  getCachedPageBySlug,
  getCachedPublishedPageSlugs,
  getCachedSiteConfig,
} from "@/lib/cache/public-site-data";
import { getPageType } from "@/lib/bulletins/schema";
import { prefetchPageCalendarEvents } from "@/lib/calendar/prefetch";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
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
import {
  PAGE_UNLOCK_COOKIE_NAME,
  isPageUnlockedInCookie,
} from "@/lib/pages/unlock-cookie";
import { buildNavTree, sortQuickLinks } from "@/lib/sitemap/tree";

/** Cache until publish triggers on-demand revalidation. */
export const revalidate = false;

/** Pre-render published pages at build time; new slugs still work at runtime. */
export const dynamicParams = true;

export async function generateStaticParams() {
  if (!isFirebaseAdminConfigured()) return [];

  const slugs = await getCachedPublishedPageSlugs();
  return slugs.map((slug) => {
    const normalized = (slug || "").replace(/^\/+|\/+$/g, "");
    if (!normalized) return { slug: undefined };
    return { slug: normalized.split("/") };
  });
}

export async function generateMetadata({ params }) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join("/") || "";

  if (!isFirebaseAdminConfigured()) {
    return { title: "Parish Website" };
  }

  const page = await getCachedPageBySlug(slug);
  const publicPage = resolvePublishedPageView(page);
  if (isPageHidden(publicPage)) {
    return { title: "Page not found" };
  }

  if (isPagePasswordProtected(page)) {
    const cookieStore = await cookies();
    const unlocked = isPageUnlockedInCookie(
      cookieStore.get(PAGE_UNLOCK_COOKIE_NAME)?.value,
      page.id,
    );
    if (!unlocked) {
      return {
        title: publicPage?.title || "Protected page",
        robots: { index: false, follow: false },
      };
    }
  }

  const site = await getCachedSiteConfig();
  return {
    title: publicPage?.seo?.title || publicPage?.title || site?.name || "Parish",
    description: publicPage?.seo?.description || site?.seo?.description,
  };
}

export default async function PublicPage({ params }) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join("/") || "";

  if (!isFirebaseAdminConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Firebase Admin is not configured. Add <code>FIREBASE_ADMIN_*</code> credentials to{" "}
          <code>.env.local</code> to serve public pages.
        </div>
      </div>
    );
  }

  const [siteConfig, nodes, page, hiddenPagesCached] = await Promise.all([
    getCachedSiteConfig(),
    getCachedNavNodes(),
    getCachedPageBySlug(slug),
    getCachedHiddenPages(),
  ]);
  const { pageIds: hiddenPageIds, slugs: hiddenSlugs } = asHiddenPageSets(hiddenPagesCached);

  const publicPage = resolvePublishedPageView(page);

  if (!publicPage || isPageHidden(publicPage)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-zinc-500">
          <a href="/login" className="text-blue-600 underline">Sign in</a> to create pages.
        </p>
      </div>
    );
  }

  if (isPagePasswordProtected(page)) {
    const cookieStore = await cookies();
    const unlocked = isPageUnlockedInCookie(
      cookieStore.get(PAGE_UNLOCK_COOKIE_NAME)?.value,
      page.id,
    );
    if (!unlocked) {
      return <PasswordGate pageId={page.id} pageTitle={publicPage.title} />;
    }
  }

  const navTree = filterNavTreeForPublic(buildNavTree(nodes), hiddenPageIds);
  const quickLinks = filterQuickLinksForPublic(sortQuickLinks(nodes), hiddenPageIds);
  const safePage = stripPasswordHash(publicPage);
  const [bulletins, calendarEventsByModuleId] = await Promise.all([
    getPageType(safePage) === "bulletins" ? getCachedBulletins() : Promise.resolve([]),
    prefetchPageCalendarEvents(safePage, siteConfig.timezone),
  ]);

  return (
    <DesignPreviewGate slug={slug}>
      <PublicSite
        siteConfig={filterSiteConfigForPublic(siteConfig, hiddenSlugs)}
        navTree={navTree}
        navNodes={nodes}
        quickLinks={quickLinks}
        hiddenPageIds={hiddenPageIds}
        page={safePage}
        pageId={page.id}
        bulletins={bulletins}
        calendarEventsByModuleId={calendarEventsByModuleId}
      />
    </DesignPreviewGate>
  );
}
