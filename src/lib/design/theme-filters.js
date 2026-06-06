/** @typedef {import("./themes/catalog.js").Theme} Theme */

/** @typedef {Object} ThemeFilters
 * @property {string[]} dominantColor
 * @property {string[]} headerLayout
 * @property {string[]} navStyle
 * @property {string[]} mood
 */

export const FILTER_OPTIONS = {
  dominantColor: [
    { value: "red", label: "Red" },
    { value: "orange", label: "Orange" },
    { value: "gold", label: "Gold" },
    { value: "green", label: "Green" },
    { value: "blue", label: "Blue" },
    { value: "purple", label: "Purple" },
    { value: "pink", label: "Pink" },
    { value: "brown", label: "Brown" },
    { value: "black", label: "Black" },
    { value: "grey", label: "Grey" },
    { value: "white", label: "White" },
  ],
  headerLayout: [
    { value: "centered", label: "Centered" },
    { value: "logoLeft", label: "Logo Left" },
  ],
  navStyle: [
    { value: "solid", label: "Solid" },
    { value: "transparent", label: "Transparent" },
  ],
  mood: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ],
};

/** @returns {ThemeFilters} */
export function emptyFilters() {
  return {
    dominantColor: [],
    headerLayout: [],
    navStyle: [],
    mood: [],
  };
}

/**
 * @param {Theme[]} themes
 * @param {ThemeFilters} filters
 * @returns {Theme[]}
 */
export function filterThemes(themes, filters) {
  return themes.filter((theme) => {
    if (filters.dominantColor.length > 0 && !filters.dominantColor.includes(theme.meta.dominantColor)) {
      return false;
    }
    if (filters.headerLayout.length > 0 && !filters.headerLayout.includes(theme.layout.header)) {
      return false;
    }
    if (filters.navStyle.length > 0 && !filters.navStyle.includes(theme.layout.nav)) {
      return false;
    }
    if (filters.mood.length > 0 && !filters.mood.includes(theme.meta.mood)) {
      return false;
    }
    return true;
  });
}

/**
 * Classify a hex color into a dominant color bucket (for custom colors).
 * @param {string} hex
 * @returns {string}
 */
export function getDominantColorFromHex(hex) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "grey";

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;

  if (lightness > 0.9) return "white";
  if (lightness < 0.15) return "black";
  if (max - min < 30) return "grey";

  if (r >= g && r >= b) {
    if (g > b * 1.3) return "orange";
    if (b > g * 1.1) return "pink";
    return "red";
  }
  if (g >= r && g >= b) {
    if (r > b * 1.2) return "gold";
    return "green";
  }
  if (r > g) return "purple";
  return "blue";
}
