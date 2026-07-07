import { generateId } from "../sitemap/tree.js";

function now() {
  return new Date().toISOString();
}

/**
 * @param {Partial<import("@/types/firestore").AdminDocumentationNote>} [overrides]
 * @returns {import("@/types/firestore").AdminDocumentationNote}
 */
export function createEmptyNote(overrides = {}) {
  const timestamp = now();
  return {
    id: generateId(),
    title: "",
    body: "",
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

/**
 * @param {unknown} note
 * @param {number} index
 * @returns {import("@/types/firestore").AdminDocumentationNote | null}
 */
function normalizeNote(note, index) {
  if (!note || typeof note !== "object") return null;
  const raw = /** @type {Record<string, unknown>} */ (note);
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : generateId();
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const order = typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : index;
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : now();
  const updatedAt = typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : createdAt;

  /** @type {import("@/types/firestore").AdminDocumentationUpdatedBy | undefined} */
  let updatedBy;
  if (raw.updatedBy && typeof raw.updatedBy === "object") {
    const by = /** @type {Record<string, unknown>} */ (raw.updatedBy);
    updatedBy = {
      ...(typeof by.uid === "string" ? { uid: by.uid } : {}),
      ...(typeof by.email === "string" ? { email: by.email } : {}),
      ...(by.source === "ui" || by.source === "mcp" ? { source: by.source } : {}),
    };
    if (Object.keys(updatedBy).length === 0) updatedBy = undefined;
  }

  return {
    id,
    title,
    body,
    order,
    createdAt,
    updatedAt,
    ...(updatedBy ? { updatedBy } : {}),
  };
}

/**
 * @param {unknown} data
 * @returns {import("@/types/firestore").AdminDocumentationRecord}
 */
export function normalizeAdminDocumentation(data) {
  const raw = data && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : {};
  const notesInput = Array.isArray(raw.notes) ? raw.notes : [];
  const notes = notesInput
    .map((note, index) => normalizeNote(note, index))
    .filter((note) => note !== null)
    .sort((a, b) => a.order - b.order)
    .map((note, index) => ({ ...note, order: index }));

  return {
    notes,
    updatedAt: typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : now(),
  };
}
