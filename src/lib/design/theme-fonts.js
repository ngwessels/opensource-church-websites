/** Google Font families loaded via layout.jsx. */
export const THEME_FONT_FAMILIES = {
  serif: "var(--font-theme-serif)",
  sans: "var(--font-theme-sans)",
  display: "var(--font-theme-display)",
  classic: "var(--font-theme-classic)",
  modern: "var(--font-theme-modern)",
  elegant: "var(--font-theme-elegant)",
  condensed: "var(--font-theme-condensed)",
  tenor: "var(--font-theme-tenor)",
  work: "var(--font-theme-work)",
  poppins: "var(--font-theme-poppins)",
};

/** Font preset options for ColorFontEditor (includes theme font variables). */
export const FONT_PRESETS = [
  { value: THEME_FONT_FAMILIES.serif, label: "Theme Serif (Merriweather)" },
  { value: THEME_FONT_FAMILIES.sans, label: "Theme Sans (Source Sans 3)" },
  { value: THEME_FONT_FAMILIES.display, label: "Theme Display (Playfair)" },
  { value: THEME_FONT_FAMILIES.classic, label: "Classic (Libre Baskerville)" },
  { value: THEME_FONT_FAMILIES.modern, label: "Modern (Montserrat)" },
  { value: THEME_FONT_FAMILIES.elegant, label: "Elegant (Cormorant)" },
  { value: THEME_FONT_FAMILIES.condensed, label: "Condensed (Oswald)" },
  { value: THEME_FONT_FAMILIES.tenor, label: "Tenor Sans" },
  { value: THEME_FONT_FAMILIES.work, label: "Work Sans" },
  { value: THEME_FONT_FAMILIES.poppins, label: "Poppins" },
  { value: "Georgia, serif", label: "Georgia (System)" },
  { value: "Arial, sans-serif", label: "Arial (System)" },
  { value: "var(--font-geist-sans), sans-serif", label: "Geist Sans" },
];

export function isPresetFont(value) {
  return FONT_PRESETS.some((p) => p.value === value);
}

/** Collect unique Google Font family names needed for a set of font CSS values. */
export function collectGoogleFontNames(fontValues = []) {
  const map = {
    "var(--font-theme-serif)": "Merriweather",
    "var(--font-theme-sans)": "Source Sans 3",
    "var(--font-theme-display)": "Playfair Display",
    "var(--font-theme-classic)": "Libre Baskerville",
    "var(--font-theme-modern)": "Montserrat",
    "var(--font-theme-elegant)": "Cormorant Garamond",
    "var(--font-theme-condensed)": "Oswald",
    "var(--font-theme-tenor)": "Tenor Sans",
    "var(--font-theme-work)": "Work Sans",
    "var(--font-theme-poppins)": "Poppins",
  };
  const names = new Set();
  for (const value of fontValues) {
    const name = map[value];
    if (name) names.add(name);
  }
  return [...names];
}
