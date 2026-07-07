import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  AUDIT_SNAPSHOTS_SUBCOLLECTION,
  COLLECTIONS,
} from "@/lib/firestore/paths";

import {
  getActorFromUid,
  resolveMcpToolName,
  resolveServerActor,
  resolveServerAuditSource,
} from "./actor.server.js";
import { buildAuditWrites } from "./build-writes.js";

/**
 * @typedef {import('./schema.js').AuditAction} AuditAction
 * @typedef {import('./schema.js').AuditActor} AuditActor
 * @typedef {import('./schema.js').AuditSource} AuditSource
 * @typedef {import('./schema.js').AuditResource} AuditResource
 * @typedef {import('./schema.js').AuditContext} AuditContext
 */

/**
 * @param {object} input
 * @param {AuditAction} input.action
 * @param {AuditResource} input.resource
 * @param {string} input.summary
 * @param {AuditActor} [input.actor]
 * @param {AuditSource} [input.source]
 * @param {AuditContext} [input.context]
 * @param {unknown} [input.before]
 * @param {unknown} [input.after]
 * @param {import('firebase-admin/firestore').WriteBatch} [input.batch]
 * @returns {Promise<string | null>}
 */
export async function recordAuditEvent(input) {
  const actor = await resolveServerActor(input.actor);
  if (!actor) {
    console.warn("[audit] skipped event without actor", { summary: input.summary });
    return null;
  }

  const source = input.source ?? resolveServerAuditSource();
  const toolName = resolveMcpToolName();
  const resource = toolName
    ? { ...input.resource, toolName: input.resource.toolName ?? toolName }
    : input.resource;

  const { eventId, writes } = buildAuditWrites({
    action: input.action,
    actor,
    source,
    resource,
    summary: input.summary,
    context: input.context,
    before: input.before,
    after: input.after,
  });

  const db = getFirebaseAdminFirestore();
  if (!db) {
    console.warn("[audit] Firebase Admin is not configured");
    return null;
  }

  if (input.batch) {
    appendAuditWritesToAdminBatch(input.batch, db, writes);
    return eventId;
  }

  const batch = db.batch();
  appendAuditWritesToAdminBatch(batch, db, writes);
  await batch.commit();
  return eventId;
}

/**
 * @param {import('firebase-admin/firestore').WriteBatch} batch
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {Array<{ refPath: string, data: unknown }>} writes
 */
export function appendAuditWritesToAdminBatch(batch, db, writes) {
  for (const write of writes) {
    const segments = write.refPath.split("/");
    if (segments.length === 2) {
      batch.set(db.collection(segments[0]).doc(segments[1]), write.data);
      continue;
    }

    if (segments.length === 4 && segments[2] === AUDIT_SNAPSHOTS_SUBCOLLECTION) {
      batch.set(
        db
          .collection(segments[0])
          .doc(segments[1])
          .collection(AUDIT_SNAPSHOTS_SUBCOLLECTION)
          .doc(segments[3]),
        write.data,
      );
    }
  }
}

/**
 * @param {object} input
 * @param {AuditAction} input.action
 * @param {AuditResource} input.resource
 * @param {string} input.summary
 * @param {AuditActor} [input.actor]
 * @param {AuditSource} [input.source]
 * @param {AuditContext} [input.context]
 * @param {() => Promise<unknown>} [input.readBefore]
 * @param {() => Promise<unknown>} input.mutate
 * @param {(result: unknown) => unknown} [input.buildAfter]
 */
export async function runAuditedMutation(input) {
  const before = input.readBefore ? await input.readBefore() : undefined;
  const result = await input.mutate();
  const after = input.buildAfter ? input.buildAfter(result) : result;

  await recordAuditEvent({
    action: input.action,
    actor: input.actor,
    source: input.source,
    resource: input.resource,
    summary: input.summary,
    context: input.context,
    before,
    after,
  });

  return result;
}

export { getActorFromUid };
