"use client";

import { SiteAnalyticsPanel } from "@/components/analytics/SiteAnalyticsPanel";

export default function BuilderAnalyticsPage() {
  return (
    <div className="h-full overflow-y-auto bg-muted/30 p-4 sm:p-6">
      <SiteAnalyticsPanel />
    </div>
  );
}
