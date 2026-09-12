"use client";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { usePages } from "@/hooks/usePages";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export function AdminSectionPage({ sectionId }) {
  const { config, loading: configLoading } = useSiteConfig();
  const { pages, loading: pagesLoading } = usePages();

  if (configLoading || pagesLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  return <AdminPanel siteConfig={config} pageCount={pages.length} sectionId={sectionId} />;
}
