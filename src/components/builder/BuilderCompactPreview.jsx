"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PublicSite } from "@/components/site/PublicSite";
import { useAuth } from "@/hooks/useAuth";
import { slugFromBuilderEditPath } from "@/lib/builder/navigation";

export function BuilderCompactPreview() {
  const pathname = usePathname();
  const slug = slugFromBuilderEditPath(pathname);
  const { user } = useAuth();

  const [siteConfig, setSiteConfig] = useState(null);
  const [page, setPage] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [navTree, setNavTree] = useState([]);
  const [navNodes, setNavNodes] = useState([]);
  const [quickLinks, setQuickLinks] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setError("Sign in as an admin to preview the site.");
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

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <p className="text-sm">{error || "Page not found"}</p>
      </div>
    );
  }

  return (
    <PublicSite
      siteConfig={siteConfig}
      navTree={navTree}
      navNodes={navNodes}
      quickLinks={quickLinks}
      page={page}
      pageId={pageId}
      bulletins={bulletins}
      designPreview
    />
  );
}
