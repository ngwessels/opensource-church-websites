/** @typedef {'link' | 'inline'} DocumentDisplayMode */

/**
 * @param {unknown} value
 * @returns {DocumentDisplayMode}
 */
function normalizeDisplayMode(value) {
  return value === "inline" ? "inline" : "link";
}

/**
 * @param {{ mimeType?: string, url?: string, label?: string }} item
 * @returns {boolean}
 */
export function isPdfDocument(item) {
  if (item.mimeType === "application/pdf") return true;

  const url = typeof item.url === "string" ? item.url : "";
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  if (path.endsWith(".pdf")) return true;

  const label = typeof item.label === "string" ? item.label : "";
  if (label.toLowerCase().endsWith(".pdf")) return true;

  return false;
}

/**
 * @param {unknown} raw
 * @returns {{ label: string, url: string, mediaId?: string, mimeType?: string, displayMode: DocumentDisplayMode, source: 'library' | 'external' }}
 */
export function normalizeDocumentItem(raw) {
  if (!raw || typeof raw !== "object") {
    return { label: "", url: "", source: "library", displayMode: "link" };
  }

  const item = /** @type {Record<string, unknown>} */ (raw);
  const url =
    typeof item.url === "string"
      ? item.url
      : typeof item.href === "string"
        ? item.href
        : "";
  const mediaId = typeof item.mediaId === "string" ? item.mediaId : "";
  const mimeType = typeof item.mimeType === "string" ? item.mimeType : "";
  let displayMode = normalizeDisplayMode(item.displayMode);

  let source = "library";
  if (mediaId || item.source === "library") {
    source = "library";
  } else if (item.source === "external" || url) {
    source = "external";
  }

  if (displayMode === "inline" && (!mediaId || !isPdfDocument({ mimeType, url, label: typeof item.label === "string" ? item.label : "" }))) {
    displayMode = "link";
  }

  return {
    label: typeof item.label === "string" ? item.label : "",
    url,
    ...(mediaId ? { mediaId } : {}),
    ...(mimeType ? { mimeType } : {}),
    displayMode,
    source,
  };
}

/**
 * @param {unknown} raw
 * @param {{ filterEmpty?: boolean }} [options]
 * @returns {{ title: string, items: Array<{ label: string, url: string, mediaId?: string, mimeType?: string, displayMode: DocumentDisplayMode }> }}
 */
export function normalizeDocumentsConfig(raw, options = {}) {
  const { filterEmpty = false } = options;

  if (!raw || typeof raw !== "object") {
    return { title: "Documents", items: [] };
  }

  const c = /** @type {Record<string, unknown>} */ (raw);
  const items = Array.isArray(c.items) ? c.items.map(normalizeDocumentItem) : [];

  const filtered = filterEmpty
    ? items.filter((item) => item.label.trim() && item.url.trim())
    : items;

  return {
    title: typeof c.title === "string" && c.title.trim() ? c.title.trim() : "Documents",
    items: filtered.map((item) => ({
      label: item.label.trim(),
      url: item.url.trim(),
      ...(item.mediaId ? { mediaId: item.mediaId } : {}),
      ...(item.mimeType ? { mimeType: item.mimeType } : {}),
      ...(item.displayMode === "inline" ? { displayMode: "inline" } : {}),
    })),
  };
}

/**
 * @returns {{ label: string, url: string, source: 'library' | 'external', displayMode: DocumentDisplayMode }}
 */
export function createEmptyDocumentItem() {
  return { label: "", url: "", source: "library", displayMode: "link" };
}
