import { getMaxContentColumns } from "./viewports.js";

export const FEATURES_REGION_ID = "features";
export const SIDEBAR_REGION_ID = "sidebar";
export const DEFAULT_CONTENT_COLUMNS = 1;
export const DEFAULT_MAX_MODULES_PER_REGION = 10;
export const MAX_FEATURES_MODULES = 1;

const CONTENT_COLUMN_TYPES = new Set([
  "text",
  "links",
  "buttons",
  "documents",
  "people",
  "calendar",
  "form",
  "image",
  "gallery",
  "photo_albums",
  "carousel",
  "video",
  "zoom",
  "mass_times",
  "daily_readings",
  "embed",
  "facebook",
  "google_maps",
  "instagram",
  "rss",
]);

const FEATURES_TYPES = new Set(["slideshow", "feature_tiles"]);

export const FEATURES_MODULE_TYPES = FEATURES_TYPES;

export function isFeaturesModuleType(type) {
  return FEATURES_TYPES.has(type);
}

export function getContentRegionId(index) {
  return `content-${index}`;
}

export function getContentRegionIds(columnCount = DEFAULT_CONTENT_COLUMNS) {
  return Array.from({ length: columnCount }, (_, i) => getContentRegionId(i + 1));
}

export function getContentColumnCount(page) {
  return getMaxContentColumns(page);
}

export function getMaxModulesPerRegion(page) {
  return page?.maxModulesPerRegion ?? DEFAULT_MAX_MODULES_PER_REGION;
}

export function getRegionLabel(regionId, columnCount) {
  if (regionId === FEATURES_REGION_ID) return "Features";
  if (regionId === SIDEBAR_REGION_ID) return "Sidebar";
  const match = regionId.match(/^content-(\d+)$/);
  if (match) {
    const n = Number(match[1]);
    if (columnCount > 1) return `Column ${n}`;
    return "Main content";
  }
  return regionId;
}

export function getRegionModules(page, regionId) {
  const region = page?.regions?.find((r) => r.id === regionId);
  return [...(region?.modules || [])].sort((a, b) => a.order - b.order);
}

export function findModuleRegionId(page, moduleId) {
  if (!moduleId) return null;
  const region = page?.regions?.find((r) => (r.modules || []).some((m) => m.id === moduleId));
  return region?.id ?? null;
}

export function getRegionModuleCount(page, regionId) {
  return getRegionModules(page, regionId).length;
}

export function isRegionFull(page, regionId, excludeModuleId) {
  let count = getRegionModuleCount(page, regionId);
  if (excludeModuleId) {
    const region = page?.regions?.find((r) => r.id === regionId);
    if (region?.modules?.some((m) => m.id === excludeModuleId)) count -= 1;
  }
  if (regionId === FEATURES_REGION_ID) return count >= MAX_FEATURES_MODULES;
  return count >= getMaxModulesPerRegion(page);
}

export function isSidebarLayout(layout) {
  return layout === "sidebar-left" || layout === "sidebar-right";
}

export function isContentRegion(regionId) {
  return regionId.startsWith("content-");
}

export function canDropModuleType(type, targetKind, regionId) {
  if (targetKind === "features" || regionId === FEATURES_REGION_ID) {
    return FEATURES_TYPES.has(type);
  }
  if (isContentRegion(regionId) || regionId === SIDEBAR_REGION_ID) {
    return CONTENT_COLUMN_TYPES.has(type);
  }
  return false;
}

export function getDropValidationError(type, regionId, page, { excludeModuleId } = {}) {
  const layout = page?.layout || "default";
  const columnCount = getContentColumnCount(page);
  const contentIds = getContentRegionIds(columnCount);

  if (regionId === SIDEBAR_REGION_ID && !isSidebarLayout(layout)) {
    return "No regions on the page allow for this module.";
  }

  if (isContentRegion(regionId) && !contentIds.includes(regionId)) {
    return "No regions on the page allow for this module.";
  }

  if (isFeaturesModuleType(type) && regionId !== FEATURES_REGION_ID) {
    return "Features modules must be placed in the features area.";
  }

  if (!isFeaturesModuleType(type) && regionId === FEATURES_REGION_ID) {
    return "Only slideshow or feature tile modules can be placed in the features area.";
  }

  if (isRegionFull(page, regionId, excludeModuleId)) {
    const max =
      regionId === FEATURES_REGION_ID ? MAX_FEATURES_MODULES : getMaxModulesPerRegion(page);
    const label = getRegionLabel(regionId, columnCount);
    return `${label} has reached the maximum number of modules (${max}).`;
  }

  if (!canDropModuleType(type, regionId === FEATURES_REGION_ID ? "features" : "region", regionId)) {
    return "No regions on the page allow for this module.";
  }

  return null;
}

/** Migrate legacy pages: main → content-1, slideshows → features */
export function normalizePageRegions(page) {
  if (!page) return page;

  const columnCount = getContentColumnCount(page);
  const contentIds = getContentRegionIds(columnCount);
  const regions = [...(page.regions || [])];
  let changed = false;

  const mainIdx = regions.findIndex((r) => r.id === "main");
  if (mainIdx >= 0) {
    const main = regions[mainIdx];
    const content1Idx = regions.findIndex((r) => r.id === "content-1");
    const slideshows = (main.modules || []).filter((m) => isFeaturesModuleType(m.type));
    const otherModules = (main.modules || []).filter((m) => !isFeaturesModuleType(m.type));

    if (slideshows.length > 0) {
      let features = regions.find((r) => r.id === FEATURES_REGION_ID);
      if (!features) {
        features = { id: FEATURES_REGION_ID, modules: [] };
        regions.push(features);
      }
      features.modules = [
        ...(features.modules || []),
        ...slideshows.map((m, i) => ({ ...m, region: FEATURES_REGION_ID, order: i })),
      ];
      changed = true;
    }

    if (content1Idx >= 0) {
      regions[content1Idx].modules = [
        ...(regions[content1Idx].modules || []),
        ...otherModules.map((m) => ({ ...m, region: "content-1" })),
      ];
    } else {
      regions.push({ id: "content-1", modules: otherModules.map((m) => ({ ...m, region: "content-1" })) });
    }

    regions.splice(mainIdx, 1);
    changed = true;
  }

  for (const id of contentIds) {
    if (!regions.find((r) => r.id === id)) {
      regions.push({ id, modules: [] });
      changed = true;
    }
  }

  if (!regions.find((r) => r.id === FEATURES_REGION_ID)) {
    regions.push({ id: FEATURES_REGION_ID, modules: [] });
  }

  const features = regions.find((r) => r.id === FEATURES_REGION_ID);
  for (const region of regions) {
    if (!isContentRegion(region.id)) continue;
    const featureModules = (region.modules || []).filter((m) => isFeaturesModuleType(m.type));
    if (featureModules.length === 0) continue;
    region.modules = (region.modules || []).filter((m) => !isFeaturesModuleType(m.type));
    if ((features.modules || []).length === 0) {
      features.modules = featureModules.map((m, i) => ({ ...m, region: FEATURES_REGION_ID, order: i }));
    }
    changed = true;
  }

  const normalized = {
    ...page,
    contentColumns: columnCount,
    maxModulesPerRegion: getMaxModulesPerRegion(page),
    regions,
  };

  return changed ? normalized : page;
}

export function buildRegionsForColumnCount(page, newColumnCount) {
  const regions = [...(page.regions || [])];
  const contentIds = getContentRegionIds(newColumnCount);

  for (const id of contentIds) {
    if (!regions.find((r) => r.id === id)) {
      regions.push({ id, modules: [] });
    }
  }

  return regions;
}

export function canReduceColumns(page, newColumnCount) {
  const current = getContentColumnCount(page);
  if (newColumnCount >= current) return { ok: true };
  for (let i = newColumnCount + 1; i <= current; i++) {
    const id = getContentRegionId(i);
    if (getRegionModuleCount(page, id) > 0) {
      return {
        ok: false,
        error: `Column ${i} still has modules. Move or delete them before reducing columns.`,
      };
    }
  }
  return { ok: true };
}

export function insertModuleAt(regions, regionId, module, insertIndex) {
  const next = regions.map((r) => ({ ...r, modules: [...(r.modules || [])] }));
  let target = next.find((r) => r.id === regionId);
  if (!target) {
    target = { id: regionId, modules: [] };
    next.push(target);
  }

  const modules = [...target.modules];
  const index = Math.max(0, Math.min(insertIndex ?? modules.length, modules.length));
  modules.splice(index, 0, { ...module, region: regionId });
  target.modules = modules.map((m, i) => ({ ...m, order: i }));
  return next;
}

export function moveModule(regions, moduleId, toRegionId, insertIndex) {
  let moving = null;
  let sourceRegionId = null;
  let sourceIndex = -1;

  const stripped = regions.map((r) => {
    const modules = [...(r.modules || [])];
    const idx = modules.findIndex((m) => m.id === moduleId);
    if (idx >= 0) {
      moving = modules[idx];
      sourceRegionId = r.id;
      sourceIndex = idx;
      modules.splice(idx, 1);
      return { ...r, modules: modules.map((m, i) => ({ ...m, order: i })) };
    }
    return { ...r, modules: [...(r.modules || [])] };
  });

  if (!moving) return regions;

  let targetIndex = insertIndex;
  if (sourceRegionId === toRegionId && sourceIndex < insertIndex) {
    targetIndex -= 1;
  }

  return insertModuleAt(stripped, toRegionId, moving, targetIndex);
}

export function clearFeaturesRegion(regions) {
  return (regions || []).map((r) =>
    r.id === FEATURES_REGION_ID ? { ...r, modules: [] } : r,
  );
}

export function removeModuleById(regions, moduleId) {
  if (!moduleId) return regions || [];
  return (regions || []).map((r) => ({
    ...r,
    modules: (r.modules || [])
      .filter((m) => m.id !== moduleId)
      .map((m, i) => ({ ...m, order: i })),
  }));
}

export function hasFeaturesModule(page) {
  return getRegionModuleCount(page, FEATURES_REGION_ID) > 0;
}

/** @deprecated Use hasFeaturesModule */
export function hasFeaturesSlideshow(page) {
  const mod = getRegionModules(page, FEATURES_REGION_ID)[0];
  return mod?.type === "slideshow";
}

/** Whether the hero slideshow section is available in the editor (optional). */
export function isHeroSlideshowEnabled(page) {
  const mod = getRegionModules(page, FEATURES_REGION_ID)[0];
  if (mod?.type === "slideshow") return true;
  if (mod?.type === "feature_tiles") return false;
  return page?.heroSlideshowEnabled !== false;
}
