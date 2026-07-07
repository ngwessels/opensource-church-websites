import { doc, getDoc, writeBatch } from "firebase/firestore";

import { appendAuditEventToClientBatch } from "@/lib/audit/record.client";

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
 */

/**
 * @param {import('firebase/firestore').DocumentReference} ref
 * @param {Record<string, unknown>} patch
 * @param {AuditMeta} audit
 */
export async function auditedUpdateDoc(ref, patch, audit) {
  const snap = await getDoc(ref);
  const before = audit.before ?? (snap.exists() ? { id: snap.id, ...snap.data() } : null);
  const after = audit.after ?? (before ? { ...before, ...patch } : { id: snap.id, ...patch });

  const batch = writeBatch(ref.firestore);
  batch.update(ref, patch);
  appendAuditEventToClientBatch(batch, ref.firestore, {
    action: audit.action,
    actor: audit.actor,
    resource: audit.resource,
    summary: audit.summary,
    context: audit.context,
    before,
    after,
  });
  await batch.commit();
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

  const batch = writeBatch(ref.firestore);
  batch.set(ref, data);
  appendAuditEventToClientBatch(batch, ref.firestore, {
    action: audit.action,
    actor: audit.actor,
    resource: audit.resource,
    summary: audit.summary,
    context: audit.context,
    before: before ?? undefined,
    after,
  });
  await batch.commit();
}

/**
 * @param {import('firebase/firestore').DocumentReference} ref
 * @param {AuditMeta} audit
 */
export async function auditedDeleteDoc(ref, audit) {
  const snap = await getDoc(ref);
  const before = audit.before ?? (snap.exists() ? { id: snap.id, ...snap.data() } : null);

  const batch = writeBatch(ref.firestore);
  batch.delete(ref);
  appendAuditEventToClientBatch(batch, ref.firestore, {
    action: audit.action,
    actor: audit.actor,
    resource: audit.resource,
    summary: audit.summary,
    context: audit.context,
    before: before ?? undefined,
    after: audit.after,
  });
  await batch.commit();
}

/**
 * Run a custom write batch and append a single audit event.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {(batch: import('firebase/firestore').WriteBatch) => void | Promise<void>} applyWrites
 * @param {AuditMeta} audit
 */
export async function auditedWriteBatch(db, applyWrites, audit) {
  const batch = writeBatch(db);
  await applyWrites(batch);
  appendAuditEventToClientBatch(batch, db, {
    action: audit.action,
    actor: audit.actor,
    resource: audit.resource,
    summary: audit.summary,
    context: audit.context,
    before: audit.before,
    after: audit.after,
  });
  await batch.commit();
}

/**
 * @param {import('@/hooks/useAuth').AuthUser | null | undefined} user
 * @param {{ role?: import('@/types/firestore').UserRole, displayName?: string } | null | undefined} profile
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
