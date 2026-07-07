import { doc } from "firebase/firestore";

import {
  AUDIT_SNAPSHOTS_SUBCOLLECTION,
  COLLECTIONS,
} from "@/lib/firestore/paths";

import { buildAuditWrites } from "./build-writes.js";

/**
 * @typedef {import('./schema.js').AuditAction} AuditAction
 * @typedef {import('./schema.js').AuditActor} AuditActor
 * @typedef {import('./schema.js').AuditResource} AuditResource
 * @typedef {import('./schema.js').AuditContext} AuditContext
 */

/**
 * @param {import('firebase/firestore').WriteBatch} batch
 * @param {import('firebase/firestore').Firestore} db
 * @param {object} input
 * @param {AuditAction} input.action
 * @param {AuditActor} input.actor
 * @param {AuditResource} input.resource
 * @param {string} input.summary
 * @param {AuditContext} [input.context]
 * @param {unknown} [input.before]
 * @param {unknown} [input.after]
 * @returns {string}
 */
export function appendAuditEventToClientBatch(batch, db, input) {
  const { eventId, writes } = buildAuditWrites({
    action: input.action,
    actor: input.actor,
    source: "ui",
    resource: input.resource,
    summary: input.summary,
    context: input.context,
    before: input.before,
    after: input.after,
  });

  for (const write of writes) {
    const segments = write.refPath.split("/");
    if (segments.length === 2) {
      batch.set(doc(db, segments[0], segments[1]), write.data);
      continue;
    }

    if (segments.length === 4 && segments[2] === AUDIT_SNAPSHOTS_SUBCOLLECTION) {
      const eventRef = doc(db, segments[0], segments[1]);
      batch.set(doc(eventRef, AUDIT_SNAPSHOTS_SUBCOLLECTION, segments[3]), write.data);
    }
  }

  return eventId;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {object} input
 * @param {AuditAction} input.action
 * @param {AuditActor} input.actor
 * @param {AuditResource} input.resource
 * @param {string} input.summary
 * @param {AuditContext} [input.context]
 * @param {unknown} [input.before]
 * @param {unknown} [input.after]
 * @returns {Promise<string>}
 */
export async function recordAuditEventClient(input) {
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);
  const eventId = appendAuditEventToClientBatch(batch, db, input);
  await batch.commit();
  return eventId;
}
