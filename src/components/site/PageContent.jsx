"use client";

import {
  getContentColumnCount,
  getContentRegionIds,
  getRegionModules,
  isSidebarLayout,
  SIDEBAR_REGION_ID,
} from "@/lib/pages/regions";
import { getResponsiveLayoutStyle } from "@/lib/pages/viewports";
import { filterSectionNavItems } from "@/lib/pages/visibility";
import { getSectionNavContext } from "@/lib/sitemap/tree";

import { RegionColumn } from "@/components/builder/RegionColumn";
import { DroppableFeatures } from "./DroppableFeatures";
import { SectionNav } from "./SectionNav";

export function PageContent({
  page,
  siteConfig,
  navNodes = [],
  pageId,
  hiddenPageIds = null,
  editing = false,
  onEditModule,
  onSaveModule,
  onRemoveModule,
  trayOpen = false,
  onRemoveSlideshow,
  onEditSlideshow,
  heroCaptionVariant = "bottomGradient",
  isDragActive = false,
  dragType = null,
  previewViewport = null,
  donationReturnPath = null,
  onEditDonation,
}) {
  const layout = page?.layout || "default";
  const columnCount = getContentColumnCount(page);
  const contentIds = getContentRegionIds(columnCount);
  const layoutOptions = previewViewport ? { previewViewport } : {};
  const responsiveStyle = getResponsiveLayoutStyle(page, layoutOptions);
  const useResponsiveClasses = !previewViewport;

  const sectionNavContext = getSectionNavContext(navNodes, {
    slug: page?.slug,
    pageId,
  });
  const sectionNavItems =
    sectionNavContext &&
    (!editing && hiddenPageIds?.size
      ? filterSectionNavItems(sectionNavContext.items, hiddenPageIds)
      : sectionNavContext.items);
  const hasSectionNav = Boolean(sectionNavItems?.length);
  const hasSidebarLayout = isSidebarLayout(layout);
  const sidebarFirst = hasSectionNav
    ? layout !== "sidebar-right"
    : layout === "sidebar-left";
  const sidebarModules = getRegionModules(page, SIDEBAR_REGION_ID);
  const showSidebarModules =
    hasSidebarLayout || (hasSectionNav && (editing || sidebarModules.length > 0));

  const contentColumns = contentIds.map((id) => (
    <RegionColumn
      key={id}
      regionId={id}
      page={page}
      siteConfig={siteConfig}
      editing={editing}
      onEditModule={onEditModule}
      onSaveModule={onSaveModule}
      onRemoveModule={onRemoveModule}
      isDragActive={isDragActive}
      dragType={dragType}
      columnCount={columnCount}
      className="min-w-0"
      donationReturnPath={id === "content-1" ? donationReturnPath : null}
      onEditDonation={id === "content-1" ? onEditDonation : null}
    />
  ));

  const marginClass = useResponsiveClasses ? "page-content-responsive" : "";
  const columnsClass = useResponsiveClasses ? "page-content-columns" : "grid gap-8";
  const columnsStyle = previewViewport
    ? {
        gridTemplateColumns: `repeat(${responsiveStyle["--cols-mobile"]}, minmax(0, 1fr))`,
      }
    : undefined;

  const coreClass =
    layout === "full-width" && !hasSectionNav
      ? "w-full"
      : layout === "default" && !hasSectionNav
        ? "site-content-inner mx-auto max-w-3xl"
        : "site-content-inner mx-auto w-full";

  const features = (
    <DroppableFeatures
      page={page}
      editing={editing}
      isDragActive={isDragActive}
      dragType={dragType}
      trayOpen={trayOpen}
      heroCaptionVariant={heroCaptionVariant}
      onRemoveSlideshow={onRemoveSlideshow}
      onEditSlideshow={onEditSlideshow}
    />
  );

  const sidebarColumn = (hasSectionNav || showSidebarModules) && (
    <aside className="w-full space-y-4 lg:w-1/3">
      {hasSectionNav && (
        <SectionNav
          items={sectionNavItems}
          activeNodeId={sectionNavContext.activeNodeId}
          navNodes={navNodes}
          editing={editing}
        />
      )}
      {showSidebarModules && (
        <RegionColumn
          regionId={SIDEBAR_REGION_ID}
          page={page}
          siteConfig={siteConfig}
          editing={editing}
          onEditModule={onEditModule}
          onSaveModule={onSaveModule}
          onRemoveModule={onRemoveModule}
          isDragActive={isDragActive}
          dragType={dragType}
          columnCount={columnCount}
          className="w-full"
        />
      )}
    </aside>
  );

  if (hasSectionNav || hasSidebarLayout) {
    return (
      <div id="background">
        {features}
        <div
          id="core"
          className={`flex flex-col gap-8 py-8 ${coreClass} ${marginClass} ${
            sidebarFirst ? "lg:flex-row" : "lg:flex-row-reverse"
          }`}
          style={responsiveStyle}
        >
          {sidebarColumn}
          <div
            id="content1"
            className={`min-w-0 lg:w-2/3 ${columnsClass}`}
            style={columnsStyle}
          >
            {contentColumns}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {features}
      <div
        className={`py-8 ${columnsClass} ${coreClass} ${marginClass}`}
        style={{ ...responsiveStyle, ...columnsStyle }}
      >
        {contentColumns}
      </div>
    </div>
  );
}
