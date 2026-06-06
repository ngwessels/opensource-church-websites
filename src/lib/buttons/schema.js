/**
 * @param {unknown} raw
 * @returns {{ label: string, href: string }}
 */
export function normalizeButtonItem(raw) {
  if (!raw || typeof raw !== "object") {
    return { label: "", href: "" };
  }

  const item = /** @type {Record<string, unknown>} */ (raw);
  const href =
    typeof item.href === "string"
      ? item.href
      : typeof item.url === "string"
        ? item.url
        : "";

  return {
    label: typeof item.label === "string" ? item.label : "",
    href,
  };
}

/**
 * @param {unknown} raw
 * @param {{ filterEmpty?: boolean }} [options]
 * @returns {{ items: Array<{ label: string, href: string }> }}
 */
export function normalizeButtonsConfig(raw, options = {}) {
  const { filterEmpty = false } = options;

  if (!raw || typeof raw !== "object") {
    return { items: [] };
  }

  const c = /** @type {Record<string, unknown>} */ (raw);
  const items = Array.isArray(c.items) ? c.items.map(normalizeButtonItem) : [];

  const filtered = filterEmpty
    ? items.filter((item) => item.label.trim() && item.href.trim())
    : items;

  return {
    items: filtered.map((item) => ({
      label: item.label.trim(),
      href: item.href.trim(),
    })),
  };
}

/**
 * @returns {{ label: string, href: string }}
 */
export function createEmptyButtonItem() {
  return { label: "", href: "" };
}
