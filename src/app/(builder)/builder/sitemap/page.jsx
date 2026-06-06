"use client";

import { SitemapEditor } from "@/components/sitemap/SitemapEditor";
import { useNavNodes } from "@/hooks/useNavNodes";

export default function SitemapPage() {
  const { nodes, loading } = useNavNodes();

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading sitemap…</div>;
  }

  return <SitemapEditor initialNodes={nodes} />;
}
