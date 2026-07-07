/**
 * Public page URL for builder iframes — skips admin redirect and builder chrome.
 * @param {string} [src]
 */
export function buildPublicPreviewSrc(src) {
  const base = src || "/";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}designPreview=1`;
}
