export const DEFAULT_HEADER_STYLES = {
  headerBackground: "",
  navBackground: "",
  titleColor: "#ffffff",
  taglineColor: "rgba(255, 255, 255, 0.9)",
  navTextColor: "#ffffff",
  titleFont: "",
  taglineFont: "",
  navFont: "",
  titleFontWeight: "700",
  titleFontSize: "",
  navFontSize: "",
};

export function resolveHeaderStyles(headerConfig, design) {
  const styles = { ...DEFAULT_HEADER_STYLES, ...headerConfig?.styles };
  const colors = design?.colors || {};
  const fonts = design?.fonts || {};

  return {
    headerBackground: styles.headerBackground || colors.primary || "#7f1d1d",
    navBackground: styles.navBackground || colors.secondary || "#1e3a5f",
    titleColor: styles.titleColor || "#ffffff",
    taglineColor: styles.taglineColor || "rgba(255, 255, 255, 0.9)",
    navTextColor: styles.navTextColor || "#ffffff",
    titleFont: styles.titleFont || fonts.heading || "Georgia, serif",
    taglineFont: styles.taglineFont || fonts.body || "Arial, sans-serif",
    navFont: styles.navFont || fonts.body || "Arial, sans-serif",
    titleFontWeight: styles.titleFontWeight || "700",
    titleFontSize: styles.titleFontSize || "",
    navFontSize: styles.navFontSize || "",
  };
}

export function mergeHeaderConfig(current = {}, patch = {}) {
  return {
    ...current,
    ...patch,
    styles: {
      ...DEFAULT_HEADER_STYLES,
      ...current.styles,
      ...patch.styles,
    },
  };
}
