/** @typedef {"centeredBanner"|"logoLeftStack"|"inlineNav"|"minimalBar"|"heroBand"|"lightLogoLeft"|"lightCentered"} HeaderVariant */
/** @typedef {"barBelow"|"inlineHeader"|"underlineTabs"|"pillTabs"|"minimalText"} NavVariant */
/** @typedef {"lightColumns"|"darkBand"|"minimalCenter"|"accentBar"} FooterVariant */
/** @typedef {"classic"|"card"|"flatBar"|"bordered"} ModuleVariant */
/** @typedef {"inline"|"utilityBar"|"boxedCta"} QuickLinksVariant */
/** @typedef {"slideshow"|"tileGrid"|"none"} FeaturesVariant */
/** @typedef {"bottomGradient"|"centered"|"overlayBoxLeft"} HeroCaptionVariant */
/** @typedef {"dark"|"light"} HeaderTone */

/**
 * @typedef {Object} ThemeStructure
 * @property {HeaderVariant} headerVariant
 * @property {NavVariant} navVariant
 * @property {FooterVariant} footerVariant
 * @property {ModuleVariant} moduleVariant
 * @property {QuickLinksVariant} quickLinksVariant
 * @property {FeaturesVariant} featuresVariant
 * @property {HeroCaptionVariant} heroCaptionVariant
 * @property {HeaderTone} headerTone
 */

/**
 * @typedef {Object} ThemeTokens
 * @property {{ primary: string, secondary: string, accent: string, background?: string, surface?: string, text?: string }} colors
 * @property {{ heading: string, body: string, nav?: string }} fonts
 * @property {{ titleSize?: string, navUppercase?: boolean, headingWeight?: string, letterSpacing?: string }} typography
 * @property {{ contentMaxWidth?: string, headerPaddingY?: string }} spacing
 * @property {{ moduleRadius?: string, buttonRadius?: string, moduleShadow?: string }} shape
 */

/** @type {ThemeTokens} */
export const DEFAULT_TOKENS = {
  colors: {
    primary: "#7f1d1d",
    secondary: "#1e3a5f",
    accent: "#d97706",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#18181b",
  },
  fonts: {
    heading: "var(--font-theme-serif)",
    body: "var(--font-theme-sans)",
    nav: "var(--font-theme-sans)",
  },
  typography: {
    titleSize: "",
    navUppercase: false,
    headingWeight: "700",
    letterSpacing: "",
  },
  spacing: {
    contentMaxWidth: "72rem",
    headerPaddingY: "2rem",
  },
  shape: {
    moduleRadius: "0.5rem",
    buttonRadius: "0.375rem",
    moduleShadow: "0 1px 3px rgb(0 0 0 / 0.08)",
  },
};

/** @type {ThemeStructure} */
export const DEFAULT_STRUCTURE = {
  headerVariant: "centeredBanner",
  navVariant: "barBelow",
  footerVariant: "lightColumns",
  moduleVariant: "classic",
  quickLinksVariant: "inline",
  featuresVariant: "slideshow",
  heroCaptionVariant: "bottomGradient",
  headerTone: "dark",
};

/** Derive legacy layout.header / layout.nav from structure for backward compat. */
export function structureToLegacyLayout(structure = DEFAULT_STRUCTURE) {
  const header =
    structure.headerVariant === "logoLeftStack" ||
    structure.headerVariant === "inlineNav" ||
    structure.headerVariant === "lightLogoLeft"
      ? "logoLeft"
      : "centered";
  const nav =
    structure.navVariant === "minimalText" ||
    structure.navVariant === "underlineTabs" ||
    structure.headerTone === "light"
      ? "transparent"
      : "solid";
  return { header, nav };
}

/**
 * Merge partial tokens with defaults.
 * @param {Partial<ThemeTokens>} [tokens]
 * @returns {ThemeTokens}
 */
export function mergeTokens(tokens = {}) {
  return {
    colors: { ...DEFAULT_TOKENS.colors, ...tokens.colors },
    fonts: { ...DEFAULT_TOKENS.fonts, ...tokens.fonts },
    typography: { ...DEFAULT_TOKENS.typography, ...tokens.typography },
    spacing: { ...DEFAULT_TOKENS.spacing, ...tokens.spacing },
    shape: { ...DEFAULT_TOKENS.shape, ...tokens.shape },
  };
}

/**
 * Merge partial structure with defaults.
 * @param {Partial<ThemeStructure>} [structure]
 * @returns {ThemeStructure}
 */
export function mergeStructure(structure = {}) {
  return { ...DEFAULT_STRUCTURE, ...structure };
}

/**
 * Build inline CSS custom properties for PublicSite root.
 * @param {ThemeTokens} tokens
 * @returns {Record<string, string>}
 */
export function tokensToCssVars(tokens) {
  const t = mergeTokens(tokens);
  return {
    "--site-primary": t.colors.primary,
    "--site-secondary": t.colors.secondary,
    "--site-accent": t.colors.accent,
    "--site-bg": t.colors.background || "#ffffff",
    "--site-surface": t.colors.surface || "#ffffff",
    "--site-text": t.colors.text || "#18181b",
    "--site-heading-font": t.fonts.heading,
    "--site-body-font": t.fonts.body,
    "--site-nav-font": t.fonts.nav || t.fonts.body,
    "--site-title-size": t.typography.titleSize || "",
    "--site-heading-weight": t.typography.headingWeight || "700",
    "--site-letter-spacing": t.typography.letterSpacing || "",
    "--site-nav-uppercase": t.typography.navUppercase ? "uppercase" : "none",
    "--site-content-max": t.spacing.contentMaxWidth || "72rem",
    "--site-header-py": t.spacing.headerPaddingY || "2rem",
    "--site-module-radius": t.shape.moduleRadius || "0.5rem",
    "--site-button-radius": t.shape.buttonRadius || "0.375rem",
    "--site-module-shadow": t.shape.moduleShadow || "none",
  };
}
