"use client";

import { Suspense } from "react";

import { BulletinsPageView } from "@/components/bulletins/BulletinsPageView";
import { getPageType } from "@/lib/bulletins/schema";
import { getThemeById } from "@/lib/design/themes";

import { PageContent } from "./PageContent";
import { SectionOverlay } from "@/components/builder/SectionOverlay";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PublicSite({
  siteConfig,
  navTree,
  navNodes = [],
  quickLinks,
  page,
  pageId,
  bulletins = [],
  editing = false,
  isDragActive = false,
  dragType = null,
  onEditModule,
  onSaveModule,
  onRemoveModule,
  trayOpen = false,
  onRemoveSlideshow,
  onEditSlideshow,
  onHeaderSettings,
  onFooterSettings,
}) {
  const colors = siteConfig?.design?.colors || {};
  const fonts = siteConfig?.design?.fonts || {};
  const theme = getThemeById(siteConfig?.design?.themeId);
  const layout = siteConfig?.design?.layout || theme.layout || {};
  const headerLayout = layout.header || siteConfig?.headerConfig?.layout || "centered";
  const navStyle = layout.nav || theme.layout?.nav || "solid";
  const isBulletinsPage = getPageType(page) === "bulletins";
  const pageSlug = page?.slug ? `/${page.slug}` : "";

  return (
    <div
      className="site-root min-h-screen bg-white"
      style={{
        "--site-primary": colors.primary || "#7f1d1d",
        "--site-secondary": colors.secondary || "#1e3a5f",
        "--site-accent": colors.accent || "#d97706",
        "--site-heading-font": fonts.heading || "Georgia, serif",
        fontFamily: fonts.body,
      }}
      data-header-layout={headerLayout}
      data-nav-style={navStyle}
    >
      <SiteHeader
        siteConfig={siteConfig}
        navTree={navTree}
        navNodes={navNodes}
        quickLinks={quickLinks}
        navStyle={navStyle}
        editing={editing}
        onHeaderSettings={onHeaderSettings}
      />

      {isBulletinsPage ? (
        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-zinc-500">Loading bulletins…</div>
          }
        >
          <BulletinsPageView
            page={page}
            bulletins={bulletins}
            editing={editing}
            pageSlug={pageSlug}
          />
        </Suspense>
      ) : (
        <PageContent
          page={page}
          siteConfig={siteConfig}
          navNodes={navNodes}
          pageId={pageId}
          editing={editing}
          isDragActive={isDragActive}
          dragType={dragType}
          onEditModule={onEditModule}
          onSaveModule={onSaveModule}
          onRemoveModule={onRemoveModule}
          trayOpen={trayOpen}
          onRemoveSlideshow={onRemoveSlideshow}
          onEditSlideshow={onEditSlideshow}
        />
      )}

      <div className="relative">
        {editing && <SectionOverlay label="FOOTER" onClick={onFooterSettings} />}
        <SiteFooter siteConfig={siteConfig} />
      </div>
    </div>
  );
}
