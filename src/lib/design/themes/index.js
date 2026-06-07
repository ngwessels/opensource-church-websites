import { THEME_CATALOG } from "./catalog";
import { resolveThemeId } from "./theme-migration";
import { mergeStructure, mergeTokens } from "./templates";

export const THEMES = THEME_CATALOG;

export function getThemeById(themeId) {
  const resolvedId = resolveThemeId(themeId);
  return THEMES.find((t) => t.id === resolvedId) || THEMES[0];
}

/**
 * Resolve full design tokens/structure from saved design + catalog theme.
 * @param {object} design
 * @returns {{ theme: import("./catalog.js").Theme, structure: import("./templates.js").ThemeStructure, tokens: import("./templates.js").ThemeTokens }}
 */
export function resolveDesignTheme(design = {}) {
  const theme = getThemeById(design.themeId);
  return {
    theme,
    structure: mergeStructure({ ...theme.structure, ...design.structure }),
    tokens: mergeTokens({
      colors: { ...theme.tokens.colors, ...design.colors },
      fonts: { ...theme.tokens.fonts, ...design.fonts },
      typography: { ...theme.tokens.typography, ...design.tokens?.typography },
      spacing: { ...theme.tokens.spacing, ...design.tokens?.spacing },
      shape: { ...theme.tokens.shape, ...design.tokens?.shape },
    }),
  };
}
