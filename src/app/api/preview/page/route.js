import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { getPageType } from "@/lib/bulletins/schema";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  getHiddenPagesServer,
  getNavNodesServer,
  getPageBySlugServer,
  getSiteConfigServer,
  listBulletinsServer,
} from "@/lib/firestore/server";
import {
  asHiddenPageSets,
  filterNavTreeForPublic,
  filterQuickLinksForPublic,
  filterSiteConfigForPublic,
} from "@/lib/pages/visibility";
import { buildNavTree, sortQuickLinks } from "@/lib/sitemap/tree";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getAdminUserFromRequest(request);

    const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";

    const [siteConfig, navNodes, page, hiddenPages] = await Promise.all([
      getSiteConfigServer(),
      getNavNodesServer(),
      getPageBySlugServer(slug),
      getHiddenPagesServer(),
    ]);

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const { pageIds: hiddenPageIds, slugs: hiddenSlugs } = asHiddenPageSets({
      pageIds: Array.from(hiddenPages.pageIds),
      slugs: Array.from(hiddenPages.slugs),
    });

    const bulletins =
      getPageType(page) === "bulletins" ? await listBulletinsServer() : [];

    const navTree = filterNavTreeForPublic(buildNavTree(navNodes), hiddenPageIds);
    const quickLinks = filterQuickLinksForPublic(sortQuickLinks(navNodes), hiddenPageIds);

    return NextResponse.json({
      siteConfig: filterSiteConfigForPublic(siteConfig, hiddenSlugs),
      navNodes,
      navTree,
      quickLinks,
      page,
      pageId: page.id,
      bulletins,
      hiddenPageIds: Array.from(hiddenPageIds),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    const status =
      message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    console.error("[preview/page]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
