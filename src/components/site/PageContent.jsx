"use client";

import { getContentMarginXStyle } from "@/lib/pages/layout";
import {
  getContentColumnCount,
  getContentRegionIds,
  getRegionModules,
  isSidebarLayout,
  SIDEBAR_REGION_ID,
} from "@/lib/pages/regions";
import { getSectionNavContext } from "@/lib/sitemap/tree";

import { RegionColumn } from "@/components/builder/RegionColumn";
import { DroppableFeatures } from "./DroppableFeatures";
import { SectionNav } from "./SectionNav";

export function PageContent({
  page,
  siteConfig,
  navNodes = [],
  pageId,
  editing = false,
  onEditModule,
  onSaveModule,
  onRemoveModule,
  trayOpen = false,
  onRemoveSlideshow,
  onEditSlideshow,
  isDragActive = false,
  dragType = null,
}) {
  const layout = page?.layout || "default";
  const columnCount = getContentColumnCount(page);
  const contentIds = getContentRegionIds(columnCount);
  const sectionNavContext = getSectionNavContext(navNodes, {
    slug: page?.slug,
    pageId,
  });
  const hasSectionNav = Boolean(sectionNavContext);
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
      className="min-w-0 flex-1"
    />
  ));

  const marginStyle = getContentMarginXStyle(page);
  const coreClass =
    layout === "full-width" && !hasSectionNav
      ? "w-full"
      : layout === "default" && !hasSectionNav
        ? "mx-auto max-w-3xl"
        : "mx-auto max-w-6xl";

  const features = (
    <DroppableFeatures
      page={page}
      editing={editing}
      isDragActive={isDragActive}
      dragType={dragType}
      trayOpen={trayOpen}
      onRemoveSlideshow={onRemoveSlideshow}
      onEditSlideshow={onEditSlideshow}
    />
  );

  const sidebarColumn = (hasSectionNav || showSidebarModules) && (
    <aside className="w-full space-y-4 lg:w-1/3">
      {hasSectionNav && (
        <SectionNav
          items={sectionNavContext.items}
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
          className={`flex flex-col gap-8 py-8 ${coreClass} ${
            sidebarFirst ? "lg:flex-row" : "lg:flex-row-reverse"
          }`}
          style={marginStyle}
        >
          {sidebarColumn}
          <div
            id="content1"
            className={`flex min-w-0 flex-col gap-8 ${columnCount > 1 ? "lg:flex-row" : ""} lg:w-2/3`}
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
        className={`flex flex-col gap-8 py-8 ${columnCount > 1 ? "lg:flex-row" : ""} ${coreClass}`}
        style={marginStyle}
      >
        {contentColumns}
      </div>
    </div>
  );
}
