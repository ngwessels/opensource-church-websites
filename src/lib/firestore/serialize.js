/**
 * Firestore rejects undefined field values. Strip them before writes.
 * @param {Record<string, unknown>} data
 */
export function stripUndefined(data) {
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * @param {Record<string, unknown>} node
 */
export function serializeNavNode(node) {
  const { children, ...data } = node;
  const cleaned = stripUndefined(data);
  if (!cleaned.isQuickLink) {
    delete cleaned.quickLinkOrder;
  }
  return cleaned;
}
