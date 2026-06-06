"use client";

import { DesignPanel } from "@/components/design/DesignPanel";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function DesignPage() {
  const { config, loading } = useSiteConfig();

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return <DesignPanel siteConfig={config} />;
}
