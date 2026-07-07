import {
  AUDIT_SNAPSHOTS_SUBCOLLECTION,
  COLLECTIONS,
} from "../firestore/paths.js";

import { buildAuditEventRecord, buildSnapshotDocument, prepareSnapshotPayload, stripUndefinedForFirestore } from "./schema.js";

/**
 * @param {object} input
 * @param {string} [input.eventId]
 * @param {import('./schema.js').AuditAction} input.action
 * @param {import('./schema.js').AuditActor} input.actor
 * @param {import('./schema.js').AuditSource} input.source
 * @param {import('./schema.js').AuditResource} input.resource
 * @param {string} input.summary
 * @param {import('./schema.js').AuditContext} [input.context]
 * @param {unknown} [input.before]
 * @param {unknown} [input.after]
 */
export function buildAuditWrites(input) {
  const eventId = input.eventId ?? `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const hasBeforeSnapshot = input.before !== undefined;
  const hasAfterSnapshot = input.after !== undefined;

  const event = buildAuditEventRecord({
    id: eventId,
    action: input.action,
    actor: input.actor,
    source: input.source,
    resource: input.resource,
    summary: input.summary,
    context: input.context,
    hasBeforeSnapshot,
    hasAfterSnapshot,
  });

  /** @type {Array<{ refPath: string, data: unknown }>} */
  const writes = [
    {
      refPath: `${COLLECTIONS.auditEvents}/${eventId}`,
      data: stripUndefinedForFirestore(event),
    },
  ];

  if (hasBeforeSnapshot) {
    const prepared = prepareSnapshotPayload(input.before);
    writes.push({
      refPath: `${COLLECTIONS.auditEvents}/${eventId}/${AUDIT_SNAPSHOTS_SUBCOLLECTION}/before`,
      data: buildSnapshotDocument(prepared),
    });
  }

  if (hasAfterSnapshot) {
    const prepared = prepareSnapshotPayload(input.after);
    writes.push({
      refPath: `${COLLECTIONS.auditEvents}/${eventId}/${AUDIT_SNAPSHOTS_SUBCOLLECTION}/after`,
      data: buildSnapshotDocument(prepared),
    });
  }

  return { eventId, event, writes };
}
