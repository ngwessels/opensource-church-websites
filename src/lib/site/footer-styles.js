export const DEFAULT_FOOTER_STYLES = {
  footerBackground: "",
  headingColor: "",
  textColor: "",
  linkColor: "",
  copyrightColor: "",
  headingFont: "",
  bodyFont: "",
  linkFont: "",
  headingFontWeight: "600",
  headingFontSize: "",
  bodyFontSize: "",
  linkFontSize: "",
  copyrightFontSize: "",
};

/**
 * @param {{ styles?: Partial<typeof DEFAULT_FOOTER_STYLES> } | null | undefined} footerConfig
 * @param {{ fonts?: { heading?: string, body?: string } } | null | undefined} design
 */
export function resolveFooterStyles(footerConfig, design) {
  const styles = { ...DEFAULT_FOOTER_STYLES, ...footerConfig?.styles };
  const fonts = design?.fonts || {};

  return {
    footerBackground: styles.footerBackground || "",
    headingColor: styles.headingColor || "",
    textColor: styles.textColor || "",
    linkColor: styles.linkColor || "",
    copyrightColor: styles.copyrightColor || "",
    headingFont: styles.headingFont || fonts.heading || "Georgia, serif",
    bodyFont: styles.bodyFont || fonts.body || "Arial, sans-serif",
    linkFont: styles.linkFont || fonts.body || "Arial, sans-serif",
    headingFontWeight: styles.headingFontWeight || "600",
    headingFontSize: styles.headingFontSize || "",
    bodyFontSize: styles.bodyFontSize || "",
    linkFontSize: styles.linkFontSize || "",
    copyrightFontSize: styles.copyrightFontSize || "",
  };
}

export function mergeFooterConfig(current = {}, patch = {}) {
  return {
    ...current,
    ...patch,
    styles: {
      ...DEFAULT_FOOTER_STYLES,
      ...current.styles,
      ...patch.styles,
    },
  };
}
