import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { mergeHeaderConfig } from "@/lib/site/header-styles";
import { MODULE_CATEGORIES } from "@/types/firestore";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function configRef() {
  return getDb().collection(COLLECTIONS.site).doc(SITE_CONFIG_ID);
}

function now() {
  return new Date().toISOString();
}

export async function getSiteConfigAdmin() {
  const snap = await configRef().get();
  if (!snap.exists) throw new Error("Site config not found");
  return snap.data();
}

export async function updateSiteConfigAdmin(partial) {
  await configRef().update({ ...partial, updatedAt: now() });
  return getSiteConfigAdmin();
}

function mergeDesign(current = {}, patch = {}) {
  return {
    ...current,
    ...patch,
    colors: { ...current.colors, ...patch.colors },
    fonts: { ...current.fonts, ...patch.fonts },
    layout: { ...current.layout, ...patch.layout },
  };
}

export async function updateSiteDesignAdmin(design) {
  const current = await getSiteConfigAdmin();
  return updateSiteConfigAdmin({ design: mergeDesign(current.design, design) });
}

export async function updateSiteSettingsAdmin({ name, tagline, canonicalDomain }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (tagline !== undefined) patch.tagline = tagline;
  if (canonicalDomain !== undefined) patch.canonicalDomain = canonicalDomain;
  return updateSiteConfigAdmin(patch);
}

export async function updateHeaderConfigAdmin(headerConfig) {
  const current = await getSiteConfigAdmin();
  return updateSiteConfigAdmin({
    headerConfig: mergeHeaderConfig(current.headerConfig, headerConfig),
  });
}

export async function updateHeaderStylesAdmin(styles) {
  return updateHeaderConfigAdmin({ styles });
}

export async function updateFooterConfigAdmin(footerConfig) {
  return updateSiteConfigAdmin({ footerConfig });
}

export async function updateMassTimesAdmin(massTimes) {
  return updateSiteConfigAdmin({ massTimes });
}

export function getBuilderCapabilities() {
  return {
    moduleTypes: Object.values(MODULE_CATEGORIES).flat(),
    moduleCategories: MODULE_CATEGORIES,
    layouts: ["default", "full-width", "sidebar-left", "sidebar-right"],
    regions: {
      content: "content-N columns",
      features: "slideshow only",
      sidebar: "sidebar layouts only",
    },
    headerCustomization: {
      tools: ["get_header_config", "update_header_config", "update_header_styles", "update_site_settings", "update_site_design"],
      styleFields: [
        "headerBackground",
        "navBackground",
        "titleColor",
        "taglineColor",
        "navTextColor",
        "titleFont",
        "taglineFont",
        "navFont",
        "titleFontWeight",
        "titleFontSize",
        "navFontSize",
      ],
    },
    rules: [
      "Slideshow modules must be placed in the features region",
      "Only slideshow modules can be placed in the features region",
      "Each region has a max module count",
    ],
  };
}

export async function getSiteSummaryAdmin() {
  const db = getDb();
  const [config, pagesSnap, navSnap] = await Promise.all([
    getSiteConfigAdmin(),
    db.collection(COLLECTIONS.pages).get(),
    db.collection(COLLECTIONS.navNodes).get(),
  ]);
  return {
    siteName: config.name,
    themeId: config.design?.themeId,
    pageCount: pagesSnap.size,
    navNodeCount: navSnap.size,
    canonicalDomain: config.canonicalDomain,
  };
}
