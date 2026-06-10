import {
  getContentColumnCount,
  getContentRegionIds,
  getRegionModules,
  isContentRegion,
} from "./regions.js";
import { getResponsiveContentColumns, PAGE_VIEWPORTS } from "./viewports.js";

/** Virtual region id for single-column stack drag targets in the builder. */
export const CONTENT_STACK_REGION_ID = "content-stack";

/** @typedef {'mobile' | 'tablet' | 'desktop'} PageViewport */

const STACK_VIEWPORTS = /** @type {const} */ (["mobile", "tablet"]);

/**
 * @param {object | null | undefined} page
 * @param {PageViewport | null | undefined} viewport
 */
export function usesStackedContentLayout(page, viewport) {
  if (!viewport || viewport === "desktop") return false;
  return getResponsiveContentColumns(page, viewport) === 1;
}

/**
 * @param {object | null | undefined} page
 */
export function getDefaultContentStackOrder(page) {
  const columnCount = getContentColumnCount(page);
  const contentIds = getContentRegionIds(columnCount);
  const ids = [];

  for (const regionId of contentIds) {
    for (const mod of getRegionModules(page, regionId)) {
      ids.push(mod.id);
    }
  }

  return ids;
}

/**
 * @param {object | null | undefined} page
 */
export function getAllContentModuleIds(page) {
  return getDefaultContentStackOrder(page);
}

/**
 * @param {object | null | undefined} page
 * @param {PageViewport} viewport
 */
export function getContentStackOrder(page, viewport) {
  const explicit = page?.contentStackOrderByViewport?.[viewport];
  if (Array.isArray(explicit) && explicit.length > 0) {
    return reconcileStackOrderIds(page, explicit);
  }
  return getDefaultContentStackOrder(page);
}

/**
 * Keep explicit order but drop unknown ids and append any missing modules.
 * @param {object | null | undefined} page
 * @param {string[]} orderIds
 */
function reconcileStackOrderIds(page, orderIds) {
  const allIds = new Set(getAllContentModuleIds(page));
  const seen = new Set();
  const next = [];

  for (const id of orderIds) {
    if (!allIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }

  for (const id of getDefaultContentStackOrder(page)) {
    if (!seen.has(id)) next.push(id);
  }

  return next;
}

/**
 * @param {object | null | undefined} page
 * @param {PageViewport} viewport
 */
export function getStackedContentModules(page, viewport) {
  const order = getContentStackOrder(page, viewport);
  const byId = new Map();

  for (const region of page?.regions || []) {
    if (!isContentRegion(region.id)) continue;
    for (const mod of region.modules || []) {
      byId.set(mod.id, mod);
    }
  }

  return order.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * @param {object | null | undefined} page
 * @param {PageViewport} viewport
 * @param {string[]} moduleIds
 */
export function reorderContentStack(page, viewport, moduleIds) {
  const reconciled = reconcileStackOrderIds(page, moduleIds);
  return {
    ...page,
    contentStackOrderByViewport: {
      ...(page?.contentStackOrderByViewport || {}),
      [viewport]: reconciled,
    },
  };
}

/**
 * @param {object | null | undefined} page
 * @param {PageViewport} viewport
 * @param {string} moduleId
 * @param {number} insertIndex
 */
export function insertIntoContentStack(page, viewport, moduleId, insertIndex) {
  const current = getContentStackOrder(page, viewport).filter((id) => id !== moduleId);
  const index = Math.max(0, Math.min(insertIndex ?? current.length, current.length));
  current.splice(index, 0, moduleId);
  return reorderContentStack(page, viewport, current);
}

/**
 * @param {object | null | undefined} page
 * @param {string} moduleId
 */
export function removeFromContentStackOrders(page, moduleId) {
  if (!moduleId || !page?.contentStackOrderByViewport) return page;

  let changed = false;
  /** @type {Record<string, string[]>} */
  const next = { ...page.contentStackOrderByViewport };

  for (const viewport of STACK_VIEWPORTS) {
    const order = next[viewport];
    if (!Array.isArray(order)) continue;
    const filtered = order.filter((id) => id !== moduleId);
    if (filtered.length !== order.length) {
      next[viewport] = filtered;
      changed = true;
    }
  }

  if (!changed) return page;

  const pruned = Object.fromEntries(
    Object.entries(next).filter(([, ids]) => Array.isArray(ids) && ids.length > 0),
  );

  return {
    ...page,
    contentStackOrderByViewport: Object.keys(pruned).length > 0 ? pruned : undefined,
  };
}

/**
 * Sync stack arrays after desktop region edits or module lifecycle changes.
 * @param {object | null | undefined} page
 */
export function reconcileContentStackOrders(page) {
  if (!page) return page;

  const defaultOrder = getDefaultContentStackOrder(page);
  const existing = page.contentStackOrderByViewport || {};
  let changed = false;

  /** @type {Record<string, string[]>} */
  const next = {};

  for (const viewport of STACK_VIEWPORTS) {
    const current = existing[viewport];
    if (!Array.isArray(current) || current.length === 0) continue;
    const reconciled = reconcileStackOrderIds(page, current);
    if (
      reconciled.length !== current.length ||
      reconciled.some((id, i) => id !== current[i])
    ) {
      changed = true;
    }
    if (reconciled.length > 0 && reconciled.join() !== defaultOrder.join()) {
      next[viewport] = reconciled;
    } else if (reconciled.join() !== defaultOrder.join()) {
      next[viewport] = reconciled;
      changed = true;
    } else if (current.length > 0) {
      changed = true;
    }
  }

  if (!changed) return page;

  return {
    ...page,
    contentStackOrderByViewport: Object.keys(next).length > 0 ? next : undefined,
  };
}

/**
 * Whether explicit stack order differs from the default region walk.
 * @param {object | null | undefined} page
 * @param {PageViewport} viewport
 */
export function hasCustomContentStackOrder(page, viewport) {
  const explicit = page?.contentStackOrderByViewport?.[viewport];
  if (!Array.isArray(explicit) || explicit.length === 0) return false;
  const defaultOrder = getDefaultContentStackOrder(page);
  const reconciled = reconcileStackOrderIds(page, explicit);
  return reconciled.join() !== defaultOrder.join();
}

/**
 * @param {object | null | undefined} page
 */
export function usesAnyStackedContentLayout(page) {
  return STACK_VIEWPORTS.some((viewport) => usesStackedContentLayout(page, viewport));
}

/**
 * @param {object | null | undefined} page
 */
export function getStackViewportsNeedingCustomRender(page) {
  return PAGE_VIEWPORTS.filter(
    (viewport) => viewport !== "desktop" && usesStackedContentLayout(page, viewport),
  );
}
