export const MAX_MEDIA_DESCRIPTION_LENGTH = 500;
export const MAX_MEDIA_ALT_LENGTH = 200;
export const MAX_MEDIA_TAGS = 20;

/** @param {string | string[] | undefined} tags */
export function normalizeTags(tags) {
  if (!tags) return [];
  const list = Array.isArray(tags)
    ? tags
    : String(tags)
        .split(",")
        .map((t) => t.trim());
  return list.filter(Boolean).slice(0, MAX_MEDIA_TAGS);
}

/**
 * @param {{ description?: string, alt?: string, tags?: string | string[] }} fields
 */
export function normalizeMediaMetadata(fields = {}) {
  const result = {};
  if (fields.description !== undefined) {
    result.description = String(fields.description).trim().slice(0, MAX_MEDIA_DESCRIPTION_LENGTH);
  }
  if (fields.alt !== undefined) {
    result.alt = String(fields.alt).trim().slice(0, MAX_MEDIA_ALT_LENGTH);
  }
  if (fields.tags !== undefined) {
    result.tags = normalizeTags(fields.tags);
  }
  return result;
}

/**
 * Metadata fields stored on new media records.
 * @param {{ description?: string, alt?: string, tags?: string | string[] }} fields
 */
export function buildMediaMetadataFields(fields = {}) {
  const normalized = normalizeMediaMetadata(fields);
  return {
    description: normalized.description ?? "",
    alt: normalized.alt ?? "",
    tags: normalized.tags ?? [],
  };
}
