"use client";

import {
  getContentColumnCount,
  getContentRegionIds,
  getRegionModules,
  isSidebarLayout,
  SIDEBAR_REGION_ID,
} from "@/lib/pages/regions";
import {
  usesStackedContentLayout,
} from "@/lib/pages/stack-layout";
import {
  getResponsiveContentColumns,
  getResponsiveLayoutStyle,
} from "@/lib/pages/viewports";
import { filterSectionNavItems } from "@/lib/pages/visibility";
import { getSectionNavContext } from "@/lib/sitemap/tree";

import { RegionColumn } from "@/components/builder/RegionColumn";
import { StackedContentColumn } from "@/components/builder/StackedContentColumn";
import { DroppableFeatures } from "./DroppableFeatures";
import { SectionNav } from "./SectionNav";

function ContentRegionGrid({
  page,
  siteConfig,
  calendarEventsByModuleId,
  editing,
  onEditModule,
  onSaveModule,
  onRemoveModule,
  isDragActive,
  dragType,
  columnCount,
  contentIds,
  donationReturnPath,
  onEditDonation,
  className,
  style,
  visibilityClass = "",
}) {
  const contentColumns = contentIds.map((id) => (
    <RegionColumn
      key={id}
      regionId={id}
      page={page}
      siteConfig={siteConfig}
      calendarEventsByModuleId={calendarEventsByModuleId}
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

  return (
    <div className={`${visibilityClass} ${className || ""}`.trim()} style={style}>
      {contentColumns}
    </div>
  );
}

function ResponsiveStackedContent({
  page,
  siteConfig,
  calendarEventsByModuleId,
  viewport,
  visibilityClass,
  donationReturnPath,
}) {
  return (
    <div className={visibilityClass}>
      <StackedContentColumn
        page={page}
        siteConfig={siteConfig}
        calendarEventsByModuleId={calendarEventsByModuleId}
        previewViewport={viewport}
        editing={false}
        donationReturnPath={donationReturnPath}
      />
    </div>
  );
}

function resolvePublicContentLayouts(page) {
  const mobileStack = usesStackedContentLayout(page, "mobile");
  const tabletStack = usesStackedContentLayout(page, "tablet");
  return { mobileStack, tabletStack };
}

export function PageContent({
  page,
  siteConfig,
  navNodes = [],
  pageId,
  hiddenPageIds = null,
  calendarEventsByModuleId = null,
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
  const builderStackMode = editing && previewViewport && usesStackedContentLayout(page, previewViewport);

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

  const { mobileStack, tabletStack } = resolvePublicContentLayouts(page);
  const showResponsiveStacks = !editing && !previewViewport && (mobileStack || tabletStack);

  const renderMainContent = ({ className, style, gridClassName, gridStyle } = {}) => {
    if (builderStackMode) {
      return (
        <StackedContentColumn
          page={page}
          siteConfig={siteConfig}
          calendarEventsByModuleId={calendarEventsByModuleId}
          previewViewport={previewViewport}
          editing={editing}
          onEditModule={onEditModule}
          onSaveModule={onSaveModule}
          onRemoveModule={onRemoveModule}
          isDragActive={isDragActive}
          dragType={dragType}
          className={className}
          donationReturnPath={donationReturnPath}
          onEditDonation={onEditDonation}
        />
      );
    }

    if (showResponsiveStacks) {
      const desktopGridCols = getResponsiveContentColumns(page, "desktop");
      const responsiveGridClass =
        mobileStack && tabletStack
          ? "hidden gap-8 lg:grid"
          : mobileStack
            ? "hidden gap-8 md:grid"
            : tabletStack
              ? "grid gap-8 max-lg:hidden"
              : "grid gap-8";
      const responsiveGridStyle = {
        gridTemplateColumns: `repeat(${desktopGridCols}, minmax(0, 1fr))`,
      };

      return (
        <>
          {mobileStack && (
            <ResponsiveStackedContent
              page={page}
              siteConfig={siteConfig}
              calendarEventsByModuleId={calendarEventsByModuleId}
              viewport="mobile"
              visibilityClass="block md:hidden"
              donationReturnPath={donationReturnPath}
            />
          )}
          {tabletStack && (
            <ResponsiveStackedContent
              page={page}
              siteConfig={siteConfig}
              calendarEventsByModuleId={calendarEventsByModuleId}
              viewport="tablet"
              visibilityClass="hidden md:block lg:hidden"
              donationReturnPath={donationReturnPath}
            />
          )}
          <ContentRegionGrid
            page={page}
            siteConfig={siteConfig}
            calendarEventsByModuleId={calendarEventsByModuleId}
            editing={editing}
            onEditModule={onEditModule}
            onSaveModule={onSaveModule}
            onRemoveModule={onRemoveModule}
            isDragActive={isDragActive}
            dragType={dragType}
            columnCount={columnCount}
            contentIds={contentIds}
            donationReturnPath={donationReturnPath}
            onEditDonation={onEditDonation}
            className={responsiveGridClass}
            style={responsiveGridStyle}
          />
        </>
      );
    }

    return (
      <ContentRegionGrid
        page={page}
        siteConfig={siteConfig}
        calendarEventsByModuleId={calendarEventsByModuleId}
        editing={editing}
        onEditModule={onEditModule}
        onSaveModule={onSaveModule}
        onRemoveModule={onRemoveModule}
        isDragActive={isDragActive}
        dragType={dragType}
        columnCount={columnCount}
        contentIds={contentIds}
        donationReturnPath={donationReturnPath}
        onEditDonation={onEditDonation}
        className={className}
        style={style}
      />
    );
  };

  const marginClass = useResponsiveClasses ? "page-content-responsive" : "";
  const columnsClass = useResponsiveClasses ? "page-content-columns" : "grid gap-8";
  const columnsStyle = previewViewport && !builderStackMode
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
      previewViewport={previewViewport}
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
          calendarEventsByModuleId={calendarEventsByModuleId}
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
            className={`min-w-0 lg:w-2/3 ${builderStackMode || showResponsiveStacks ? "" : columnsClass}`}
            style={builderStackMode || showResponsiveStacks ? undefined : columnsStyle}
          >
            {renderMainContent({
              className: builderStackMode || showResponsiveStacks ? undefined : "grid gap-8",
              style: columnsStyle,
              gridClassName: `grid gap-8 ${columnsClass}`,
              gridStyle: columnsStyle,
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {features}
      <div
        className={`py-8 ${builderStackMode || showResponsiveStacks ? "" : columnsClass} ${coreClass} ${marginClass}`}
        style={
          builderStackMode || showResponsiveStacks
            ? responsiveStyle
            : { ...responsiveStyle, ...columnsStyle }
        }
      >
        {renderMainContent({
          className: builderStackMode || showResponsiveStacks ? undefined : undefined,
          style: columnsStyle,
          gridClassName: `grid gap-8 ${columnsClass}`,
          gridStyle: { ...responsiveStyle, ...columnsStyle },
        })}
      </div>
    </div>
  );
}
