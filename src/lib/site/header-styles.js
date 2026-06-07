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
  const headerTone = design?.structure?.headerTone || "dark";
  const isLight = headerTone === "light";
  const lightBg = colors.background || design?.tokens?.colors?.background || "#ffffff";
  const lightText = colors.text || design?.tokens?.colors?.text || "#18181b";

  return {
    headerBackground:
      styles.headerBackground ||
      (isLight ? lightBg : colors.primary || "#7f1d1d"),
    navBackground:
      styles.navBackground ||
      (isLight ? "transparent" : colors.secondary || "#1e3a5f"),
    titleColor: styles.titleColor || (isLight ? lightText : "#ffffff"),
    taglineColor:
      styles.taglineColor ||
      (isLight ? "rgba(24, 24, 27, 0.72)" : "rgba(255, 255, 255, 0.9)"),
    navTextColor: styles.navTextColor || (isLight ? lightText : "#ffffff"),
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
