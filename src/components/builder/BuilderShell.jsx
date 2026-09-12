"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  SiteContentSearchDialog,
  SiteContentSearchTrigger,
} from "@/components/builder/SiteContentSearch";
import { BuilderCompactPreview } from "./BuilderCompactPreview";
import { BuilderRail } from "./BuilderRail";
import { BuilderSectionNav, BuilderSectionPills } from "./BuilderSectionNav";
import { BuilderTopBar } from "./BuilderTopBar";
import { ADMIN_PAGE_NAV_HEIGHT, BUILDER_MIN_VIEWPORT_WIDTH } from "@/lib/design/admin-tokens";
import { ADMIN_DOCUMENTATION_HREF } from "@/lib/builder/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useBuilderNavigation } from "@/hooks/useBuilderNavigation";
import { useMinViewportWidth } from "@/hooks/useMinViewportWidth";

export function BuilderShell({ children, bottomBar }) {
  const pathname = usePathname();
  const { user, logOut } = useAuth();
  const isDesktopViewport = useMinViewportWidth(BUILDER_MIN_VIEWPORT_WIDTH);
  const useCompactMobilePreview = pathname?.startsWith("/builder/edit");
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    siteName,
    isFinance,
    destinations,
    activeDestination,
    sections,
    sectionGroups,
    activeSection,
    utilityLabel,
  } = useBuilderNavigation();

  const canSearch = !isFinance;
  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    if (!canSearch) return undefined;
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSearch]);

  const topBar = (
    <>
      <BuilderTopBar
        siteName={siteName}
        destinations={destinations}
        activeDestination={activeDestination}
        sections={sections}
        activeSection={activeSection}
        utilityLabel={utilityLabel}
        userEmail={user?.email}
        helpHref={canSearch ? ADMIN_DOCUMENTATION_HREF : undefined}
        searchSlot={canSearch ? <SiteContentSearchTrigger onClick={openSearch} /> : null}
        onLogOut={() => logOut()}
      />
      {canSearch && <SiteContentSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />}
    </>
  );

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
        {topBar}
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
      {topBar}
      <div className="flex min-h-0 flex-1">
        <BuilderRail destinations={destinations} activeDestinationId={activeDestination?.id} />

        <div className="flex min-w-0 flex-1 flex-col">
          <BuilderSectionPills sections={sections} activeSectionId={activeSection?.id} />

          <div className="relative flex min-h-0 flex-1">
            <BuilderSectionNav
              title={activeDestination?.label}
              description={activeDestination?.description}
              sections={sections}
              groups={sectionGroups}
              activeSectionId={activeSection?.id}
            />

            <div className="relative flex min-w-0 flex-1 flex-col">
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
        </div>
      </div>
    </div>
  );
}
