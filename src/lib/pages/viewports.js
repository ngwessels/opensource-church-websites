import { DEFAULT_CONTENT_MARGIN_X, getContentMarginX, getContentMarginPaddingStyle, marginValueToCss } from "./layout.js";

const DEFAULT_CONTENT_COLUMNS = 1;

function getDesktopContentColumnCount(page) {
  if (page?.contentColumns) return page.contentColumns;
  const regions = page?.regions || [];
  const contentRegions = regions.filter((r) => r.id.startsWith("content-"));
  if (contentRegions.length > 0) return contentRegions.length;
  if (regions.some((r) => r.id === "main")) return 1;
  return DEFAULT_CONTENT_COLUMNS;
}

/** @typedef {'mobile' | 'tablet' | 'desktop'} PageViewport */

export const PAGE_VIEWPORTS = /** @type {const} */ (["mobile", "tablet", "desktop"]);

/** @type {Record<PageViewport, string>} */
export const PAGE_VIEWPORT_LABELS = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

/** Builder preview max-width per viewport (`null` = full width). */
export const PAGE_VIEWPORT_PREVIEW_WIDTHS = {
  mobile: 375,
  tablet: 768,
  desktop: null,
};

const LEGACY_COLUMNS_BY_VIEWPORT = {
  mobile: 1,
  tablet: 1,
  desktop: null,
};

/**
 * @param {unknown} value
 * @returns {value is PageViewport}
 */
export function isPageViewport(value) {
  return PAGE_VIEWPORTS.includes(value);
}

/**
 * @param {object | null | undefined} page
 * @param {PageViewport} viewport
 */
export function getResponsiveContentMarginX(page, viewport) {
  const override = page?.contentMarginXByViewport?.[viewport];
  if (override) return override;
  return getContentMarginX(page);
}

/**
 * @param {object | null | undefined} page
 * @param {PageViewport} viewport
 */
export function getResponsiveContentColumns(page, viewport) {
  const override = page?.contentColumnsByViewport?.[viewport];
  if (override != null && override >= 1) return override;

  if (viewport === "desktop") {
    return getDesktopContentColumnCount(page);
  }

  return LEGACY_COLUMNS_BY_VIEWPORT[viewport] ?? 1;
}

/**
 * @param {object | null | undefined} page
 */
export function getMaxContentColumns(page) {
  return Math.max(
    ...PAGE_VIEWPORTS.map((viewport) => getResponsiveContentColumns(page, viewport)),
  );
}

/**
 * Build viewport objects from legacy fields and any existing overrides.
 * @param {object | null | undefined} page
 */
export function normalizeResponsiveLayout(page) {
  const desktopMargin = getContentMarginX(page);
  const desktopColumns = getDesktopContentColumnCount(page);

  const contentMarginXByViewport = {
    mobile: getResponsiveContentMarginX(page, "mobile"),
    tablet: getResponsiveContentMarginX(page, "tablet"),
    desktop: desktopMargin,
  };

  const contentColumnsByViewport = {
    mobile: getResponsiveContentColumns(page, "mobile"),
    tablet: getResponsiveContentColumns(page, "tablet"),
    desktop: desktopColumns,
  };

  return {
    contentMarginX: desktopMargin,
    contentColumns: getMaxContentColumns(page),
    contentMarginXByViewport,
    contentColumnsByViewport,
  };
}

/**
 * Merge form state into page update payload with synced legacy fields.
 * @param {object} marginByViewport
 * @param {object} columnsByViewport
 */
export function buildResponsiveLayoutUpdates(marginByViewport, columnsByViewport) {
  const contentMarginXByViewport = {
    mobile: marginByViewport.mobile || DEFAULT_CONTENT_MARGIN_X,
    tablet: marginByViewport.tablet || DEFAULT_CONTENT_MARGIN_X,
    desktop: marginByViewport.desktop || DEFAULT_CONTENT_MARGIN_X,
  };

  const contentColumnsByViewport = {
    mobile: columnsByViewport.mobile ?? DEFAULT_CONTENT_COLUMNS,
    tablet: columnsByViewport.tablet ?? DEFAULT_CONTENT_COLUMNS,
    desktop: columnsByViewport.desktop ?? DEFAULT_CONTENT_COLUMNS,
  };

  return {
    contentMarginX: contentMarginXByViewport.desktop,
    contentColumns: Math.max(
      contentColumnsByViewport.mobile,
      contentColumnsByViewport.tablet,
      contentColumnsByViewport.desktop,
    ),
    contentMarginXByViewport,
    contentColumnsByViewport,
  };
}

/**
 * @param {object | null | undefined} page
 * @param {{ previewViewport?: PageViewport }} [options]
 */
export function getResponsiveMarginStyle(page, { previewViewport } = {}) {
  if (previewViewport) {
    const value = getResponsiveContentMarginX(page, previewViewport);
    return getContentMarginPaddingStyle(value);
  }

  /** @type {Record<string, string>} */
  const vars = {};
  for (const viewport of PAGE_VIEWPORTS) {
    vars[`--page-margin-x-${viewport}`] = marginValueToCss(
      getResponsiveContentMarginX(page, viewport),
    );
  }
  return vars;
}

/**
 * @param {object | null | undefined} page
 * @param {{ previewViewport?: PageViewport }} [options]
 */
export function getResponsiveColumnVars(page, { previewViewport } = {}) {
  if (previewViewport) {
    const cols = getResponsiveContentColumns(page, previewViewport);
    return {
      "--cols-mobile": String(cols),
      "--cols-tablet": String(cols),
      "--cols-desktop": String(cols),
    };
  }

  /** @type {Record<string, string>} */
  const vars = {};
  for (const viewport of PAGE_VIEWPORTS) {
    vars[`--cols-${viewport}`] = String(getResponsiveContentColumns(page, viewport));
  }
  return vars;
}

/**
 * @param {object | null | undefined} page
 * @param {{ previewViewport?: PageViewport }} [options]
 */
export function getResponsiveLayoutStyle(page, options = {}) {
  return {
    ...getResponsiveMarginStyle(page, options),
    ...getResponsiveColumnVars(page, options),
  };
}

/**
 * Whether the site header should use the mobile nav layout.
 * @param {PageViewport | null | undefined} previewViewport
 * @returns {boolean | null} `true`/`false` forces layout; `null` uses Tailwind breakpoints.
 */
export function resolveMobileNavLayout(previewViewport) {
  if (previewViewport === "mobile") return true;
  if (previewViewport === "tablet" || previewViewport === "desktop") return false;
  return null;
}

/** @param {PageViewport | null | undefined} previewViewport */
export function mobileNavTriggerVisibilityClass(previewViewport) {
  const layout = resolveMobileNavLayout(previewViewport);
  if (layout === true) return "inline-flex";
  if (layout === false) return "hidden";
  return "inline-flex md:hidden";
}

/** @param {PageViewport | null | undefined} previewViewport */
export function desktopNavListVisibilityClass(previewViewport) {
  const layout = resolveMobileNavLayout(previewViewport);
  if (layout === true) return "hidden";
  if (layout === false) return "flex flex-wrap items-center justify-center gap-1";
  return "hidden md:flex flex-wrap items-center justify-center gap-1";
}

/** @param {PageViewport | null | undefined} previewViewport */
export function navBarContainerJustifyClass(previewViewport) {
  const layout = resolveMobileNavLayout(previewViewport);
  if (layout === true) return "justify-end";
  if (layout === false) return "justify-center";
  return "justify-end md:justify-center";
}

/** @param {PageViewport | null | undefined} previewViewport */
export function inlineNavVisibilityClass(previewViewport) {
  const layout = resolveMobileNavLayout(previewViewport);
  if (layout === true) return "hidden";
  if (layout === false) return "block";
  return "hidden md:block";
}

/** @param {PageViewport | null | undefined} previewViewport */
export function inlineMobileNavRowClass(previewViewport) {
  const layout = resolveMobileNavLayout(previewViewport);
  if (layout === true) return "block";
  if (layout === false) return "hidden";
  return "md:hidden";
}
