import { DEFAULT_HEADER_STYLES } from "@/lib/site/header-styles";

import { getThemeById } from "./themes";
import { mergeStructure, mergeTokens, structureToLegacyLayout } from "./themes/templates";

const DESIGN_KEYS = ["themeId", "colors", "fonts", "layout", "structure", "tokens"];
const HEADER_TEXT_COLOR_KEYS = ["titleColor", "taglineColor", "navTextColor"];

const STRUCTURE_KEYS = [
  "headerVariant",
  "navVariant",
  "footerVariant",
  "moduleVariant",
  "quickLinksVariant",
  "featuresVariant",
  "heroCaptionVariant",
  "headerTone",
];

/**
 * Shallow compare published vs draft design for unsaved-changes detection.
 * @param {object} published
 * @param {object} draft
 * @returns {boolean}
 */
export function headerTextColorsEqual(published = {}, draft = {}) {
  for (const key of HEADER_TEXT_COLOR_KEYS) {
    const publishedValue = published[key] ?? DEFAULT_HEADER_STYLES[key] ?? "";
    const draftValue = draft[key] ?? DEFAULT_HEADER_STYLES[key] ?? "";
    if (publishedValue !== draftValue) return false;
  }
  return true;
}

function structureEqual(a = {}, b = {}) {
  for (const key of STRUCTURE_KEYS) {
    if ((a[key] || "") !== (b[key] || "")) return false;
  }
  return true;
}

export function designEquals(
  published = {},
  draft = {},
  publishedHeaderStyles = {},
  draftHeaderStyles = {},
) {
  if (getThemeById(published.themeId).id !== getThemeById(draft.themeId).id) return false;

  for (const colorKey of ["primary", "secondary", "accent"]) {
    if ((published.colors?.[colorKey] || "") !== (draft.colors?.[colorKey] || "")) return false;
  }

  for (const fontKey of ["heading", "body"]) {
    if ((published.fonts?.[fontKey] || "") !== (draft.fonts?.[fontKey] || "")) return false;
  }

  if ((published.layout?.header || "") !== (draft.layout?.header || "")) return false;
  if ((published.layout?.nav || "") !== (draft.layout?.nav || "")) return false;

  if (!structureEqual(published.structure, draft.structure)) return false;

  if (!headerTextColorsEqual(publishedHeaderStyles, draftHeaderStyles)) return false;

  return true;
}

/**
 * Normalize design object with defaults from theme catalog.
 * @param {object} design
 * @param {import("./themes/catalog.js").Theme} theme
 * @returns {object}
 */
export function normalizeDesign(design = {}, theme) {
  const resolvedTheme = theme || getThemeById(design.themeId);
  const structure = mergeStructure({
    ...resolvedTheme.structure,
    ...design.structure,
  });
  const tokens = mergeTokens({
    colors: { ...resolvedTheme.tokens.colors, ...design.colors },
    fonts: { ...resolvedTheme.tokens.fonts, ...design.fonts },
    typography: { ...resolvedTheme.tokens.typography, ...design.tokens?.typography },
    spacing: { ...resolvedTheme.tokens.spacing, ...design.tokens?.spacing },
    shape: { ...resolvedTheme.tokens.shape, ...design.tokens?.shape },
  });
  const layout = design.layout?.header
    ? { header: design.layout.header, nav: design.layout.nav }
    : structureToLegacyLayout(structure);

  return {
    themeId: resolvedTheme.id,
    colors: {
      primary: tokens.colors.primary,
      secondary: tokens.colors.secondary,
      accent: tokens.colors.accent,
    },
    fonts: {
      heading: tokens.fonts.heading,
      body: tokens.fonts.body,
    },
    layout,
    structure,
    tokens,
  };
}

export { DESIGN_KEYS };
