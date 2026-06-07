"use client";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PublicSite } from "@/components/site/PublicSite";
import { useDesignPreviewListener } from "@/hooks/useDesignPreviewBridge";
import { getPageType } from "@/lib/bulletins/schema";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import {
  filterNavTreeForPublic,
  filterQuickLinksForPublic,
  filterSiteConfigForPublic,
  getHiddenPageSets,
  isPageHidden,
} from "@/lib/pages/visibility";
import { buildNavTree, sortQuickLinks } from "@/lib/sitemap/tree";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export function PublicPageClient({ slug = "" }) {
  const searchParams = useSearchParams();
  const designPreviewEnabled = searchParams.get("designPreview") === "1";
  const designPreview = useDesignPreviewListener(designPreviewEnabled);

  const [siteConfig, setSiteConfig] = useState(null);
  const [page, setPage] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [navTree, setNavTree] = useState([]);
  const [navNodes, setNavNodes] = useState([]);
  const [quickLinks, setQuickLinks] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [hiddenPageIds, setHiddenPageIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured.");
      setLoading(false);
      return;
    }

    async function load() {
      setPage(null);
      setPageId(null);
      setError(null);
      const db = getFirebaseFirestore();
      const { doc, getDoc } = await import("firebase/firestore");

      const siteSnap = await getDoc(doc(db, COLLECTIONS.site, "config"));
      const rawSiteConfig = siteSnap.exists() ? siteSnap.data() : null;

      const [navSnap, hiddenSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.navNodes)),
        getDocs(query(collection(db, COLLECTIONS.pages), where("hidden", "==", true))),
      ]);
      const nodes = navSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const hiddenPages = hiddenSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const { pageIds: hiddenPageIds, slugs: hiddenSlugs } = getHiddenPageSets(hiddenPages);

      setHiddenPageIds(hiddenPageIds);
      setSiteConfig(filterSiteConfigForPublic(rawSiteConfig, hiddenSlugs));
      setNavNodes(nodes);
      setNavTree(filterNavTreeForPublic(buildNavTree(nodes), hiddenPageIds));
      setQuickLinks(filterQuickLinksForPublic(sortQuickLinks(nodes), hiddenPageIds));

      const pageSnap = await getDocs(
        query(collection(db, COLLECTIONS.pages), where("slug", "==", slug)),
      );
      if (!pageSnap.empty) {
        const pageDoc = pageSnap.docs[0];
        const pageData = pageDoc.data();
        if (isPageHidden(pageData)) {
          setPage(null);
          setPageId(null);
          setError("Page not found");
          setLoading(false);
          return;
        }
        setPageId(pageDoc.id);
        setPage(pageData);

        if (getPageType(pageData) === "bulletins") {
          const bulletinSnap = await getDocs(
            query(collection(db, COLLECTIONS.bulletins), orderBy("date", "desc")),
          );
          setBulletins(bulletinSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } else {
        setPage(null);
        setPageId(null);
        setError("Page not found");
      }
      setLoading(false);
    }

    load().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [slug]);

  const effectiveSiteConfig = useMemo(() => {
    if (!siteConfig || !designPreview) return siteConfig;

    const previewDesign = designPreview.design;
    const headerLayout = previewDesign.layout?.header;
    const previewHeaderStyles = designPreview.headerStyles;

    let headerConfig = siteConfig.headerConfig;
    if (headerLayout || previewHeaderStyles) {
      headerConfig = {
        ...siteConfig.headerConfig,
        ...(headerLayout ? { layout: headerLayout } : {}),
        ...(previewHeaderStyles
          ? {
              styles: {
                ...siteConfig.headerConfig?.styles,
                ...previewHeaderStyles,
              },
            }
          : {}),
      };
    }

    return {
      ...siteConfig,
      design: { ...siteConfig.design, ...previewDesign },
      headerConfig,
    };
  }, [siteConfig, designPreview]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading…</div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">{error || "Page not found"}</h1>
        <p className="text-sm text-zinc-500">
          Sign in at <a href="/login" className="text-blue-600 underline">/login</a> to set up your site.
        </p>
      </div>
    );
  }

  return (
    <PublicSite
      siteConfig={effectiveSiteConfig}
      navTree={navTree}
      navNodes={navNodes}
      quickLinks={quickLinks}
      page={page}
      pageId={pageId}
      bulletins={bulletins}
      hiddenPageIds={hiddenPageIds}
      designPreview={designPreviewEnabled}
    />
  );
}
