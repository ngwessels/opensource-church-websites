import { THEME_FONT_FAMILIES } from "@/lib/design/theme-fonts";

import { mergeStructure, mergeTokens, structureToLegacyLayout } from "./templates";

/** @typedef {"red"|"orange"|"gold"|"green"|"blue"|"purple"|"pink"|"brown"|"black"|"grey"|"white"} DominantColor */
/** @typedef {"light"|"dark"} ThemeMood */
/** @typedef {import("./templates.js").HeaderVariant} HeaderVariant */
/** @typedef {import("./templates.js").NavVariant} NavVariant */
/** @typedef {import("./templates.js").FooterVariant} FooterVariant */
/** @typedef {import("./templates.js").ModuleVariant} ModuleVariant */
/** @typedef {import("./templates.js").ThemeStructure} ThemeStructure */
/** @typedef {import("./templates.js").ThemeTokens} ThemeTokens */

/**
 * @typedef {Object} ThemeMeta
 * @property {DominantColor} dominantColor
 * @property {ThemeMood} mood
 * @property {HeaderVariant} [headerVariant]
 * @property {ModuleVariant} [moduleVariant]
 */

/**
 * @typedef {Object} Theme
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} template
 * @property {ThemeStructure} structure
 * @property {ThemeTokens} tokens
 * @property {{ primary: string, secondary: string, accent: string }} colors
 * @property {{ heading: string, body: string }} fonts
 * @property {{ header: "centered"|"logoLeft", nav: "solid"|"transparent" }} layout
 * @property {ThemeMeta} meta
 */

/**
 * @param {Omit<Theme, "colors"|"fonts"|"layout"> & { tokens: ThemeTokens }} entry
 * @returns {Theme}
 */
function defineTheme(entry) {
  const structure = mergeStructure(entry.structure);
  const tokens = mergeTokens(entry.tokens);
  return {
    ...entry,
    structure,
    tokens,
    colors: {
      primary: tokens.colors.primary,
      secondary: tokens.colors.secondary,
      accent: tokens.colors.accent,
    },
    fonts: {
      heading: tokens.fonts.heading,
      body: tokens.fonts.body,
    },
    layout: structureToLegacyLayout(structure),
    meta: {
      ...entry.meta,
      headerVariant: structure.headerVariant,
      moduleVariant: structure.moduleVariant,
    },
  };
}

/** @type {Theme[]} */
export const THEME_CATALOG = [
  defineTheme({
    id: "verona",
    name: "Verona",
    description: "Stately centered banner with classic serif typography and a dark footer band.",
    template: "verona",
    structure: {
      headerVariant: "centeredBanner",
      navVariant: "barBelow",
      footerVariant: "darkBand",
      moduleVariant: "classic",
    },
    tokens: {
      colors: { primary: "#7f1d1d", secondary: "#1e3a5f", accent: "#d97706", background: "#faf9f7", text: "#1c1917" },
      fonts: { heading: THEME_FONT_FAMILIES.classic, body: THEME_FONT_FAMILIES.sans, nav: THEME_FONT_FAMILIES.sans },
      typography: { navUppercase: true, headingWeight: "700", letterSpacing: "0.02em" },
      spacing: { headerPaddingY: "2.5rem" },
      shape: { moduleRadius: "0", buttonRadius: "0.25rem", moduleShadow: "none" },
    },
    meta: { dominantColor: "red", mood: "light" },
  }),
  defineTheme({
    id: "calvary",
    name: "Calvary",
    description: "Bold hero header band with bordered modules and accent footer stripe.",
    template: "calvary",
    structure: {
      headerVariant: "heroBand",
      navVariant: "barBelow",
      footerVariant: "accentBar",
      moduleVariant: "bordered",
    },
    tokens: {
      colors: { primary: "#450a0a", secondary: "#1c1917", accent: "#eab308", background: "#fafaf9", text: "#1c1917" },
      fonts: { heading: THEME_FONT_FAMILIES.display, body: THEME_FONT_FAMILIES.sans },
      typography: { navUppercase: true, headingWeight: "700" },
      spacing: { headerPaddingY: "3.5rem" },
      shape: { moduleRadius: "0.25rem", buttonRadius: "0.25rem", moduleShadow: "none" },
    },
    meta: { dominantColor: "red", mood: "dark" },
  }),
  defineTheme({
    id: "nazareth",
    name: "Nazareth",
    description: "Traditional logo-left header with warm earth tones and column footer.",
    template: "nazareth",
    structure: {
      headerVariant: "logoLeftStack",
      navVariant: "barBelow",
      footerVariant: "lightColumns",
      moduleVariant: "classic",
    },
    tokens: {
      colors: { primary: "#78350f", secondary: "#365314", accent: "#ca8a04", background: "#fffbeb", text: "#292524" },
      fonts: { heading: THEME_FONT_FAMILIES.classic, body: THEME_FONT_FAMILIES.sans },
      spacing: { headerPaddingY: "2rem" },
      shape: { moduleRadius: "0.375rem", moduleShadow: "0 1px 2px rgb(0 0 0 / 0.06)" },
    },
    meta: { dominantColor: "brown", mood: "light" },
  }),
  defineTheme({
    id: "condit",
    name: "Condit",
    description: "Light inline navigation with logo and links on one row.",
    template: "condit",
    structure: {
      headerVariant: "inlineNav",
      navVariant: "inlineHeader",
      footerVariant: "minimalCenter",
      moduleVariant: "flatBar",
      headerTone: "light",
      quickLinksVariant: "inline",
    },
    tokens: {
      colors: { primary: "#1d4ed8", secondary: "#0f766e", accent: "#f59e0b", background: "#ffffff", text: "#0f172a" },
      fonts: { heading: THEME_FONT_FAMILIES.modern, body: THEME_FONT_FAMILIES.sans, nav: THEME_FONT_FAMILIES.modern },
      typography: { headingWeight: "600" },
      spacing: { headerPaddingY: "1.25rem", contentMaxWidth: "80rem" },
      shape: { moduleRadius: "0", buttonRadius: "9999px", moduleShadow: "none" },
    },
    meta: { dominantColor: "blue", mood: "light" },
  }),
  defineTheme({
    id: "kolbe",
    name: "Kolbe",
    description: "Clean white header with underline tab navigation and card modules.",
    template: "kolbe",
    structure: {
      headerVariant: "lightLogoLeft",
      navVariant: "underlineTabs",
      footerVariant: "lightColumns",
      moduleVariant: "card",
      headerTone: "light",
      quickLinksVariant: "boxedCta",
      featuresVariant: "slideshow",
      heroCaptionVariant: "bottomGradient",
    },
    tokens: {
      colors: { primary: "#334155", secondary: "#64748b", accent: "#6366f1", background: "#f8fafc", text: "#0f172a" },
      fonts: { heading: THEME_FONT_FAMILIES.sans, body: THEME_FONT_FAMILIES.sans },
      typography: { headingWeight: "600" },
      spacing: { headerPaddingY: "1rem" },
      shape: { moduleRadius: "0.75rem", buttonRadius: "0.5rem", moduleShadow: "0 4px 12px rgb(0 0 0 / 0.06)" },
    },
    meta: { dominantColor: "grey", mood: "light" },
  }),
  defineTheme({
    id: "lucca",
    name: "Lucca",
    description: "Elegant centered banner with pill navigation and dark footer.",
    template: "lucca",
    structure: {
      headerVariant: "centeredBanner",
      navVariant: "pillTabs",
      footerVariant: "darkBand",
      moduleVariant: "card",
    },
    tokens: {
      colors: { primary: "#9f1239", secondary: "#4c0519", accent: "#fda4af", background: "#fff1f2", text: "#1c1917" },
      fonts: { heading: THEME_FONT_FAMILIES.elegant, body: THEME_FONT_FAMILIES.sans },
      typography: { navUppercase: false, headingWeight: "600", letterSpacing: "0.03em" },
      spacing: { headerPaddingY: "2.5rem" },
      shape: { moduleRadius: "0.5rem", buttonRadius: "9999px", moduleShadow: "0 2px 8px rgb(0 0 0 / 0.08)" },
    },
    meta: { dominantColor: "pink", mood: "dark" },
  }),
  defineTheme({
    id: "sinai",
    name: "Sinai",
    description: "Dramatic hero band with pill tabs and bordered content modules.",
    template: "sinai",
    structure: {
      headerVariant: "heroBand",
      navVariant: "pillTabs",
      footerVariant: "accentBar",
      moduleVariant: "bordered",
    },
    tokens: {
      colors: { primary: "#c2410c", secondary: "#292524", accent: "#fbbf24", background: "#fafaf9", text: "#1c1917" },
      fonts: { heading: THEME_FONT_FAMILIES.condensed, body: THEME_FONT_FAMILIES.sans, nav: THEME_FONT_FAMILIES.condensed },
      typography: { navUppercase: true, headingWeight: "700", letterSpacing: "0.05em" },
      spacing: { headerPaddingY: "3rem" },
      shape: { moduleRadius: "0", buttonRadius: "9999px", moduleShadow: "none" },
    },
    meta: { dominantColor: "orange", mood: "dark" },
  }),
  defineTheme({
    id: "eden",
    name: "Eden",
    description: "Fresh garden palette with logo-left header and minimal footer.",
    template: "eden",
    structure: {
      headerVariant: "logoLeftStack",
      navVariant: "minimalText",
      footerVariant: "minimalCenter",
      moduleVariant: "flatBar",
    },
    tokens: {
      colors: { primary: "#15803d", secondary: "#4d7c0f", accent: "#f472b6", background: "#f0fdf4", text: "#14532d" },
      fonts: { heading: THEME_FONT_FAMILIES.serif, body: THEME_FONT_FAMILIES.sans },
      spacing: { headerPaddingY: "1.75rem" },
      shape: { moduleRadius: "0", buttonRadius: "0.375rem", moduleShadow: "none" },
    },
    meta: { dominantColor: "green", mood: "light" },
  }),
  defineTheme({
    id: "olivet",
    name: "Olivet",
    description: "Evergreen heritage design with underline navigation tabs.",
    template: "olivet",
    structure: {
      headerVariant: "centeredBanner",
      navVariant: "underlineTabs",
      footerVariant: "lightColumns",
      moduleVariant: "classic",
    },
    tokens: {
      colors: { primary: "#166534", secondary: "#14532d", accent: "#a3e635", background: "#f7fee7", text: "#1a2e05" },
      fonts: { heading: THEME_FONT_FAMILIES.classic, body: THEME_FONT_FAMILIES.sans },
      typography: { navUppercase: true },
      spacing: { headerPaddingY: "2.25rem" },
      shape: { moduleRadius: "0", moduleShadow: "none" },
    },
    meta: { dominantColor: "green", mood: "dark" },
  }),
  defineTheme({
    id: "damascus",
    name: "Damascus",
    description: "Strong inline nav with card modules and dark footer band.",
    template: "damascus",
    structure: {
      headerVariant: "inlineNav",
      navVariant: "barBelow",
      footerVariant: "darkBand",
      moduleVariant: "card",
    },
    tokens: {
      colors: { primary: "#57534e", secondary: "#292524", accent: "#a8a29e", background: "#fafaf9", text: "#1c1917" },
      fonts: { heading: THEME_FONT_FAMILIES.modern, body: THEME_FONT_FAMILIES.sans },
      spacing: { headerPaddingY: "1.5rem" },
      shape: { moduleRadius: "0.5rem", buttonRadius: "0.375rem", moduleShadow: "0 2px 6px rgb(0 0 0 / 0.07)" },
    },
    meta: { dominantColor: "brown", mood: "dark" },
  }),
  defineTheme({
    id: "tabor",
    name: "Tabor",
    description: "Radiant hero header with underline tabs and bordered modules.",
    template: "tabor",
    structure: {
      headerVariant: "heroBand",
      navVariant: "underlineTabs",
      footerVariant: "lightColumns",
      moduleVariant: "bordered",
    },
    tokens: {
      colors: { primary: "#b45309", secondary: "#92400e", accent: "#fde047", background: "#fffbeb", text: "#451a03" },
      fonts: { heading: THEME_FONT_FAMILIES.display, body: THEME_FONT_FAMILIES.sans },
      typography: { headingWeight: "700" },
      spacing: { headerPaddingY: "3rem" },
      shape: { moduleRadius: "0.25rem", moduleShadow: "none" },
    },
    meta: { dominantColor: "gold", mood: "light" },
  }),
  defineTheme({
    id: "loyola",
    name: "Loyola",
    description: "Deep navy minimal bar with solid navigation and classic modules.",
    template: "loyola",
    structure: {
      headerVariant: "minimalBar",
      navVariant: "barBelow",
      footerVariant: "darkBand",
      moduleVariant: "classic",
    },
    tokens: {
      colors: { primary: "#0f172a", secondary: "#1e3a8a", accent: "#38bdf8", background: "#f8fafc", text: "#0f172a" },
      fonts: { heading: THEME_FONT_FAMILIES.serif, body: THEME_FONT_FAMILIES.sans },
      typography: { navUppercase: true, headingWeight: "700" },
      spacing: { headerPaddingY: "1rem" },
      shape: { moduleRadius: "0", moduleShadow: "none" },
    },
    meta: { dominantColor: "black", mood: "dark" },
  }),
  defineTheme({
    id: "cyprus",
    name: "Cyprus",
    description: "Regal purple inline layout with pill navigation tabs.",
    template: "cyprus",
    structure: {
      headerVariant: "inlineNav",
      navVariant: "pillTabs",
      footerVariant: "accentBar",
      moduleVariant: "card",
    },
    tokens: {
      colors: { primary: "#6b21a8", secondary: "#581c87", accent: "#fbbf24", background: "#faf5ff", text: "#3b0764" },
      fonts: { heading: THEME_FONT_FAMILIES.elegant, body: THEME_FONT_FAMILIES.sans, nav: THEME_FONT_FAMILIES.modern },
      spacing: { headerPaddingY: "1.25rem" },
      shape: { moduleRadius: "0.75rem", buttonRadius: "9999px", moduleShadow: "0 2px 10px rgb(107 33 168 / 0.12)" },
    },
    meta: { dominantColor: "purple", mood: "dark" },
  }),
  defineTheme({
    id: "turin",
    name: "Turin",
    description: "Coastal minimal design with pill tabs and airy card modules.",
    template: "turin",
    structure: {
      headerVariant: "minimalBar",
      navVariant: "pillTabs",
      footerVariant: "minimalCenter",
      moduleVariant: "card",
    },
    tokens: {
      colors: { primary: "#0369a1", secondary: "#0c4a6e", accent: "#fbbf24", background: "#f0f9ff", text: "#0c4a6e" },
      fonts: { heading: THEME_FONT_FAMILIES.modern, body: THEME_FONT_FAMILIES.sans },
      spacing: { headerPaddingY: "1rem", contentMaxWidth: "76rem" },
      shape: { moduleRadius: "1rem", buttonRadius: "9999px", moduleShadow: "0 4px 16px rgb(3 105 161 / 0.08)" },
    },
    meta: { dominantColor: "blue", mood: "light" },
  }),
  defineTheme({
    id: "knights",
    name: "Knights",
    description: "School-style white header with boxed quick links, photo tile row, and centered hero captions.",
    template: "knights",
    structure: {
      headerVariant: "lightLogoLeft",
      navVariant: "underlineTabs",
      footerVariant: "lightColumns",
      moduleVariant: "classic",
      quickLinksVariant: "boxedCta",
      featuresVariant: "tileGrid",
      heroCaptionVariant: "centered",
      headerTone: "light",
    },
    tokens: {
      colors: {
        primary: "#7f1d1d",
        secondary: "#ffffff",
        accent: "#991b1b",
        background: "#ffffff",
        surface: "#ffffff",
        text: "#1c1917",
      },
      fonts: {
        heading: THEME_FONT_FAMILIES.tenor,
        body: THEME_FONT_FAMILIES.work,
        nav: THEME_FONT_FAMILIES.work,
      },
      typography: { navUppercase: true, headingWeight: "400", letterSpacing: "0.04em" },
      spacing: { headerPaddingY: "1.5rem" },
      shape: { moduleRadius: "0", buttonRadius: "0", moduleShadow: "none" },
    },
    meta: { dominantColor: "red", mood: "light" },
  }),
  defineTheme({
    id: "matthew",
    name: "Matthew",
    description: "Centered logo header with utility quick links and left overlay hero captions.",
    template: "matthew",
    structure: {
      headerVariant: "lightCentered",
      navVariant: "minimalText",
      footerVariant: "lightColumns",
      moduleVariant: "flatBar",
      quickLinksVariant: "utilityBar",
      featuresVariant: "slideshow",
      heroCaptionVariant: "overlayBoxLeft",
      headerTone: "light",
    },
    tokens: {
      colors: {
        primary: "#1e3a8a",
        secondary: "#ffffff",
        accent: "#2563eb",
        background: "#ffffff",
        surface: "#ffffff",
        text: "#0f172a",
      },
      fonts: {
        heading: THEME_FONT_FAMILIES.poppins,
        body: THEME_FONT_FAMILIES.poppins,
        nav: THEME_FONT_FAMILIES.poppins,
      },
      typography: { navUppercase: true, headingWeight: "600", letterSpacing: "0.06em" },
      spacing: { headerPaddingY: "2rem" },
      shape: { moduleRadius: "0", buttonRadius: "0.25rem", moduleShadow: "none" },
    },
    meta: { dominantColor: "blue", mood: "light" },
  }),
];
