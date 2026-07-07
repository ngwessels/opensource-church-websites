"use client";

import { usePathname } from "next/navigation";

import { AdminToolbar } from "./AdminToolbar";
import { BuilderCompactPreview } from "./BuilderCompactPreview";
import { ADMIN_PAGE_NAV_HEIGHT, BUILDER_MIN_VIEWPORT_WIDTH } from "@/lib/design/admin-tokens";
import { useMinViewportWidth } from "@/hooks/useMinViewportWidth";

export function BuilderShell({ children, bottomBar, moduleTrayOpen = false }) {
  const pathname = usePathname();
  const isDesktopViewport = useMinViewportWidth(BUILDER_MIN_VIEWPORT_WIDTH);
  const useCompactMobilePreview = pathname?.startsWith("/builder/edit");

  if (isDesktopViewport === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (isDesktopViewport === false && useCompactMobilePreview) {
    return (
      <div className="flex h-screen flex-col bg-muted">
        <AdminToolbar />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto bg-card">
            <BuilderCompactPreview />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-muted">
      <AdminToolbar />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="min-h-0 flex-1 overflow-auto bg-card"
          style={{
            paddingBottom: bottomBar ? ADMIN_PAGE_NAV_HEIGHT : 0,
          }}
        >
          {children}
        </div>
        {bottomBar}
      </div>
    </div>
  );
}
