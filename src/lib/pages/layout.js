export const DEFAULT_CONTENT_MARGIN_X = "md";

export const CONTENT_MARGIN_X_OPTIONS = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
];

const VALID_MARGIN_VALUES = new Set(CONTENT_MARGIN_X_OPTIONS.map((o) => o.value));

/** Horizontal inset applied to the page content wrapper. */
const CONTENT_MARGIN_X_STYLE = {
  none: undefined,
  sm: { paddingLeft: "0.5rem", paddingRight: "0.5rem" },
  md: { paddingLeft: "1rem", paddingRight: "1rem" },
  lg: { paddingLeft: "3rem", paddingRight: "3rem" },
  xl: { paddingLeft: "max(6rem, 10vw)", paddingRight: "max(6rem, 10vw)" },
};

export function marginValueToCss(value) {
  const style = CONTENT_MARGIN_X_STYLE[value];
  if (!style) return "0";
  return style.paddingLeft;
}

export function getContentMarginX(page) {
  const value = page?.contentMarginX;
  if (value && value in CONTENT_MARGIN_X_STYLE) return value;
  return DEFAULT_CONTENT_MARGIN_X;
}

export function getContentMarginXStyle(page) {
  return CONTENT_MARGIN_X_STYLE[getContentMarginX(page)];
}

export function getContentMarginPaddingStyle(value) {
  return CONTENT_MARGIN_X_STYLE[value] ?? CONTENT_MARGIN_X_STYLE[DEFAULT_CONTENT_MARGIN_X];
}

export function isValidContentMarginX(value) {
  return VALID_MARGIN_VALUES.has(value);
}
