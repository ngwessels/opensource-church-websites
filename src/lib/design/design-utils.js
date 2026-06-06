import { DEFAULT_HEADER_STYLES } from "@/lib/site/header-styles";

const DESIGN_KEYS = ["themeId", "colors", "fonts", "layout"];
const HEADER_TEXT_COLOR_KEYS = ["titleColor", "taglineColor", "navTextColor"];

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

export function designEquals(
  published = {},
  draft = {},
  publishedHeaderStyles = {},
  draftHeaderStyles = {},
) {
  if ((published.themeId || "classic") !== (draft.themeId || "classic")) return false;

  for (const colorKey of ["primary", "secondary", "accent"]) {
    if ((published.colors?.[colorKey] || "") !== (draft.colors?.[colorKey] || "")) return false;
  }

  for (const fontKey of ["heading", "body"]) {
    if ((published.fonts?.[fontKey] || "") !== (draft.fonts?.[fontKey] || "")) return false;
  }

  if ((published.layout?.header || "") !== (draft.layout?.header || "")) return false;
  if ((published.layout?.nav || "") !== (draft.layout?.nav || "")) return false;

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
  return {
    themeId: design.themeId || theme.id,
    colors: {
      primary: design.colors?.primary || theme.colors.primary,
      secondary: design.colors?.secondary || theme.colors.secondary,
      accent: design.colors?.accent || theme.colors.accent,
    },
    fonts: {
      heading: design.fonts?.heading || theme.fonts.heading,
      body: design.fonts?.body || theme.fonts.body,
    },
    layout: {
      header: design.layout?.header || theme.layout.header,
      nav: design.layout?.nav || theme.layout.nav,
    },
  };
}

export { DESIGN_KEYS };
