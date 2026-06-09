"use client";

import { Suspense } from "react";

import { BulletinsPageView } from "@/components/bulletins/BulletinsPageView";
import { useAdminPublicRedirect } from "@/hooks/useAdminPublicRedirect";
import { getPageType } from "@/lib/bulletins/schema";
import { resolveDesignTheme } from "@/lib/design/themes";
import { tokensToCssVars } from "@/lib/design/themes/templates";

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
  designPreview = false,
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
  previewViewport = null,
  onEditDonation,
  onBulletinsRefresh,
}) {
  const { checking: redirectingAdmin } = useAdminPublicRedirect({
    enabled: !editing && !designPreview,
    pageSlug: page?.slug ?? "",
  });

  if (redirectingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading…</div>
    );
  }

  const { theme, structure, tokens } = resolveDesignTheme(siteConfig?.design);
  const fonts = siteConfig?.design?.fonts || {};
  const layout = siteConfig?.design?.layout || theme.layout || {};
  const headerLayout = layout.header || siteConfig?.headerConfig?.layout || "centered";
  const navStyle = layout.nav || theme.layout?.nav || "solid";
  const isBulletinsPage = getPageType(page) === "bulletins";
  const isDonationPage = getPageType(page) === "donation";
  const pageSlug = page?.slug ? `/${page.slug}` : "";
  const donationReturnPath = isDonationPage ? pageSlug || "/" : null;

  const cssVars = tokensToCssVars({
    ...tokens,
    colors: {
      ...tokens.colors,
      ...siteConfig?.design?.colors,
    },
    fonts: {
      ...tokens.fonts,
      ...fonts,
    },
  });

  return (
      <div
        className="site-root flex min-h-screen flex-col"
        style={{
          ...cssVars,
          fontFamily: fonts.body || tokens.fonts.body,
        }}
        data-site-template={theme.template}
        data-header-variant={structure.headerVariant}
        data-nav-variant={structure.navVariant}
        data-footer-variant={structure.footerVariant}
        data-module-variant={structure.moduleVariant}
        data-quick-links-variant={structure.quickLinksVariant}
        data-features-variant={structure.featuresVariant}
        data-hero-caption-variant={structure.heroCaptionVariant}
        data-header-tone={structure.headerTone}
        data-nav-uppercase={tokens.typography.navUppercase ? "true" : "false"}
        data-header-layout={headerLayout}
        data-nav-style={navStyle}
      >
        <SiteHeader
          siteConfig={siteConfig}
          navTree={navTree}
          navNodes={navNodes}
          quickLinks={quickLinks}
          navStyle={navStyle}
          headerVariant={structure.headerVariant}
          quickLinksVariant={structure.quickLinksVariant}
          editing={editing}
          onHeaderSettings={onHeaderSettings}
          previewViewport={previewViewport}
        />

        <main className="flex-1">
          {isBulletinsPage ? (
            <Suspense
              fallback={
                <div className="site-content-inner mx-auto px-4 py-8 text-sm opacity-60">
                  Loading bulletins…
                </div>
              }
            >
              <BulletinsPageView
                page={page}
                bulletins={bulletins}
                editing={editing}
                pageSlug={pageSlug}
                onBulletinsRefresh={onBulletinsRefresh}
              />
            </Suspense>
          ) : (
            <PageContent
              page={page}
              siteConfig={siteConfig}
              navNodes={navNodes}
              pageId={pageId}
              editing={editing}
              heroCaptionVariant={structure.heroCaptionVariant}
              isDragActive={isDragActive}
              dragType={dragType}
              onEditModule={onEditModule}
              onSaveModule={onSaveModule}
              onRemoveModule={onRemoveModule}
              trayOpen={trayOpen}
              onRemoveSlideshow={onRemoveSlideshow}
              onEditSlideshow={onEditSlideshow}
              previewViewport={previewViewport}
              donationReturnPath={donationReturnPath}
              onEditDonation={onEditDonation}
            />
          )}
        </main>

        <div className="relative">
          {editing && <SectionOverlay label="FOOTER" onClick={onFooterSettings} />}
          <SiteFooter
            siteConfig={siteConfig}
            footerVariant={structure.footerVariant}
            quickLinks={quickLinks}
            navNodes={navNodes}
            editing={editing}
          />
        </div>
      </div>
  );
}
