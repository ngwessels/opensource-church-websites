import { THEME_CATALOG } from "./catalog";

export const THEMES = THEME_CATALOG;

export function getThemeById(themeId) {
  return THEMES.find((t) => t.id === themeId) || THEMES[0];
}
