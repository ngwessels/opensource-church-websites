"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PublicSite } from "@/components/site/PublicSite";
import { useDesignPreviewListener } from "@/hooks/useDesignPreviewBridge";
import { useAuth } from "@/hooks/useAuth";

export function DesignPreviewClient({ slug = "" }) {
  const searchParams = useSearchParams();
  const designPreviewEnabled = searchParams.get("designPreview") === "1";
  const designPreview = useDesignPreviewListener(designPreviewEnabled);
  const { user } = useAuth();

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
    if (!user) {
      setError("Sign in as an admin to preview design changes.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/preview/page?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load preview");

        if (cancelled) return;

        setSiteConfig(data.siteConfig);
        setNavNodes(data.navNodes || []);
        setNavTree(data.navTree || []);
        setQuickLinks(data.quickLinks || []);
        setPage(data.page);
        setPageId(data.pageId);
        setBulletins(data.bulletins || []);
        setHiddenPageIds(new Set(data.hiddenPageIds || []));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preview");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, user]);

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
          <a href="/login" className="text-blue-600 underline">
            Sign in
          </a>{" "}
          as an admin to preview.
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
