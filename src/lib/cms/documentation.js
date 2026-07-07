import "server-only";

import { normalizeAdminDocumentation, createEmptyNote } from "@/lib/admin/documentation";
import { recordAuditEvent } from "@/lib/audit/record.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { ADMIN_DOCUMENTATION_ID, COLLECTIONS } from "@/lib/firestore/paths";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function docRef() {
  return getDb().collection(COLLECTIONS.site).doc(ADMIN_DOCUMENTATION_ID);
}

function now() {
  return new Date().toISOString();
}

/**
 * @returns {Promise<import("@/types/firestore").AdminDocumentationRecord>}
 */
export async function getAdminDocumentationAdmin() {
  const snap = await docRef().get();
  if (!snap.exists) {
    return /** @type {import("@/types/firestore").AdminDocumentationRecord} */ ({
      notes: [],
      updatedAt: "",
    });
  }
  return normalizeAdminDocumentation(snap.data());
}

/**
 * @param {object} params
 * @param {import("@/types/firestore").AdminDocumentationNote[]} params.notes
 * @param {import("@/types/firestore").AdminDocumentationUpdatedBy} [params.updatedBy]
 */
export async function saveAdminDocumentationAdmin({ notes, updatedBy }, { audit = true } = {}) {
  const before = await getAdminDocumentationAdmin();
  const timestamp = now();
  const normalizedNotes = normalizeAdminDocumentation({ notes, updatedAt: timestamp }).notes.map(
    (note) => ({
      ...note,
      updatedAt: timestamp,
      ...(updatedBy ? { updatedBy } : {}),
    }),
  );

  const record = {
    notes: normalizedNotes,
    updatedAt: timestamp,
  };

  await docRef().set(record);

  if (audit) {
    await recordAuditEvent({
      action: "update",
      resource: { type: "admin_documentation", path: "site/adminDocumentation" },
      summary: "Updated admin documentation",
      before,
      after: record,
    });
  }

  return record;
}

/**
 * @param {object} input
 * @param {string} [input.id]
 * @param {string} input.title
 * @param {string} input.body
 * @param {number} [input.order]
 * @param {import("@/types/firestore").AdminDocumentationUpdatedBy} [input.updatedBy]
 */
export async function upsertAdminDocumentationNoteAdmin({
  id,
  title,
  body,
  order,
  updatedBy,
}) {
  const titleTrimmed = String(title ?? "").trim();
  const bodyTrimmed = String(body ?? "").trim();
  if (!titleTrimmed) throw new Error("title is required.");

  const current = await getAdminDocumentationAdmin();
  const timestamp = now();
  const noteId = id?.trim();

  if (noteId) {
    const index = current.notes.findIndex((note) => note.id === noteId);
    if (index === -1) throw new Error("Note not found.");

    const existing = current.notes[index];
    const nextNote = {
      ...existing,
      title: titleTrimmed,
      body: bodyTrimmed,
      order: typeof order === "number" && Number.isFinite(order) ? order : existing.order,
      updatedAt: timestamp,
      ...(updatedBy ? { updatedBy } : {}),
    };
    const notes = [...current.notes];
    notes[index] = nextNote;
    const record = await saveAdminDocumentationAdmin({ notes, updatedBy }, { audit: false });

    await recordAuditEvent({
      action: "update",
      resource: { type: "admin_documentation", id: noteId, path: "site/adminDocumentation" },
      summary: `Updated documentation note ${titleTrimmed}`,
      before: current,
      after: record,
    });

    return record;
  }

  const nextOrder =
    typeof order === "number" && Number.isFinite(order) ? order : current.notes.length;
  const newNote = createEmptyNote({
    title: titleTrimmed,
    body: bodyTrimmed,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(updatedBy ? { updatedBy } : {}),
  });

  const record = await saveAdminDocumentationAdmin({
    notes: [...current.notes, newNote],
    updatedBy,
  }, { audit: false });

  await recordAuditEvent({
    action: "create",
    resource: { type: "admin_documentation", id: newNote.id, path: "site/adminDocumentation" },
    summary: `Created documentation note ${titleTrimmed}`,
    before: current,
    after: record,
  });

  return record;
}

/**
 * @param {object} input
 * @param {string} input.id
 */
export async function deleteAdminDocumentationNoteAdmin({ id }) {
  const noteId = id?.trim();
  if (!noteId) throw new Error("id is required.");

  const current = await getAdminDocumentationAdmin();
  const notes = current.notes.filter((note) => note.id !== noteId);
  if (notes.length === current.notes.length) {
    throw new Error("Note not found.");
  }

  const record = await saveAdminDocumentationAdmin({ notes }, { audit: false });

  await recordAuditEvent({
    action: "delete",
    resource: { type: "admin_documentation", id: noteId, path: "site/adminDocumentation" },
    summary: `Deleted documentation note ${noteId}`,
    before: current,
    after: record,
  });

  return record;
}
