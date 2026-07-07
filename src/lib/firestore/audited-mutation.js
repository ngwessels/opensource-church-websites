import { doc, getDoc, updateDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";

import { recordAuditEventViaApi } from "@/lib/audit/record.client";

/**
 * @typedef {import('@/lib/audit/schema.js').AuditAction} AuditAction
 * @typedef {import('@/lib/audit/schema.js').AuditActor} AuditActor
 * @typedef {import('@/lib/audit/schema.js').AuditResource} AuditResource
 * @typedef {import('@/lib/audit/schema.js').AuditContext} AuditContext
 */

/**
 * @typedef {object} AuditMeta
 * @property {AuditActor} actor
 * @property {AuditAction} action
 * @property {AuditResource} resource
 * @property {string} summary
 * @property {AuditContext} [context]
 * @property {unknown} [before]
 * @property {unknown} [after]
 * @property {() => Promise<string | undefined>} [getIdToken]
 */

/**
 * @param {AuditMeta} audit
 * @param {unknown} before
 * @param {unknown} after
 */
async function recordAudit(audit, before, after) {
  await recordAuditEventViaApi({
    action: audit.action,
    actor: audit.actor,
    resource: audit.resource,
    summary: audit.summary,
    context: audit.context,
    before: before ?? undefined,
    after: after ?? undefined,
    getIdToken: audit.getIdToken,
  });
}

/**
 * @param {import('firebase/firestore').DocumentReference} ref
 * @param {Record<string, unknown>} patch
 * @param {AuditMeta} audit
 */
export async function auditedUpdateDoc(ref, patch, audit) {
  const snap = await getDoc(ref);
  const before = audit.before ?? (snap.exists() ? { id: snap.id, ...snap.data() } : null);
  const after = audit.after ?? (before ? { ...before, ...patch } : { id: snap.id, ...patch });

  await updateDoc(ref, patch);
  await recordAudit(audit, before, after);
}

/**
 * @param {import('firebase/firestore').DocumentReference} ref
 * @param {Record<string, unknown>} data
 * @param {AuditMeta} audit
 */
export async function auditedSetDoc(ref, data, audit) {
  const snap = await getDoc(ref);
  const before = audit.before ?? (snap.exists() ? { id: snap.id, ...snap.data() } : null);
  const after = audit.after ?? { id: ref.id, ...data };

  await setDoc(ref, data);
  await recordAudit(audit, before, after);
}

/**
 * @param {import('firebase/firestore').DocumentReference} ref
 * @param {AuditMeta} audit
 */
export async function auditedDeleteDoc(ref, audit) {
  const snap = await getDoc(ref);
  const before = audit.before ?? (snap.exists() ? { id: snap.id, ...snap.data() } : null);

  await deleteDoc(ref);
  await recordAudit(audit, before, audit.after);
}

/**
 * Run a custom write batch, then record a single audit event via API.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {(batch: import('firebase/firestore').WriteBatch) => void | Promise<void>} applyWrites
 * @param {AuditMeta} audit
 */
export async function auditedWriteBatch(db, applyWrites, audit) {
  const batch = writeBatch(db);
  await applyWrites(batch);
  await batch.commit();
  await recordAudit(audit, audit.before, audit.after);
}

/**
 * @param {import('@/hooks/useAuth').AuthUser | null | undefined} user
 * @param {{ role?: import('@/types/firestore').UserRole, displayName?: string, email?: string } | null | undefined} profile
 * @returns {AuditActor | null}
 */
export function buildClientAuditActor(user, profile) {
  if (!user?.uid) return null;
  return {
    uid: user.uid,
    email: user.email ?? profile?.email ?? undefined,
    displayName: profile?.displayName ?? user.displayName ?? undefined,
    role: profile?.role,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} collectionName
 * @param {string} docId
 */
export function auditedDocRef(db, collectionName, docId) {
  return doc(db, collectionName, docId);
}
