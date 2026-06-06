/**
 * @param {unknown} raw
 * @returns {{ label: string, url: string, mediaId?: string, source: 'library' | 'external' }}
 */
export function normalizeDocumentItem(raw) {
  if (!raw || typeof raw !== "object") {
    return { label: "", url: "", source: "library" };
  }

  const item = /** @type {Record<string, unknown>} */ (raw);
  const url =
    typeof item.url === "string"
      ? item.url
      : typeof item.href === "string"
        ? item.href
        : "";
  const mediaId = typeof item.mediaId === "string" ? item.mediaId : "";
  let source = "library";
  if (mediaId || item.source === "library") {
    source = "library";
  } else if (item.source === "external" || url) {
    source = "external";
  }

  return {
    label: typeof item.label === "string" ? item.label : "",
    url,
    ...(mediaId ? { mediaId } : {}),
    source,
  };
}

/**
 * @param {unknown} raw
 * @param {{ filterEmpty?: boolean }} [options]
 * @returns {{ title: string, items: Array<{ label: string, url: string, mediaId?: string }> }}
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
    })),
  };
}

/**
 * @returns {{ label: string, url: string, source: 'library' | 'external' }}
 */
export function createEmptyDocumentItem() {
  return { label: "", url: "", source: "library" };
}
