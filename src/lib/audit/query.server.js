import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  AUDIT_SNAPSHOTS_SUBCOLLECTION,
  COLLECTIONS,
} from "@/lib/firestore/paths";

import { normalizeAuditEvent } from "./schema.js";

/**
 * @param {object} [filters]
 * @param {string} [filters.actorUid]
 * @param {string} [filters.action]
 * @param {string} [filters.resourceType]
 * @param {string} [filters.query]
 * @param {string} [filters.dateFrom]
 * @param {string} [filters.dateTo]
 * @param {number} [filters.limit]
 * @param {string} [filters.cursor]
 */
export async function listAuditEventsAdmin(filters = {}) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  let query = db.collection(COLLECTIONS.auditEvents).orderBy("timestamp", "desc");

  // Firestore composite-index limits: apply at most one equality filter server-side.
  if (filters.actorUid) {
    query = query.where("actor.uid", "==", filters.actorUid);
  } else if (filters.action) {
    query = query.where("action", "==", filters.action);
  } else if (filters.resourceType) {
    query = query.where("resource.type", "==", filters.resourceType);
  }

  if (filters.cursor) {
    const cursorSnap = await db.collection(COLLECTIONS.auditEvents).doc(filters.cursor).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.limit(limit).get();
  let events = snap.docs.map((docSnap) => normalizeAuditEvent({ id: docSnap.id, ...docSnap.data() }));

  if (filters.dateFrom) {
    events = events.filter((event) => event.timestamp >= filters.dateFrom);
  }
  if (filters.dateTo) {
    events = events.filter((event) => event.timestamp <= filters.dateTo);
  }
  if (filters.actorUid && filters.action) {
    events = events.filter((event) => event.action === filters.action);
  }
  if (filters.actorUid && filters.resourceType) {
    events = events.filter((event) => event.resource.type === filters.resourceType);
  }
  if (filters.action && filters.resourceType) {
    events = events.filter((event) => event.resource.type === filters.resourceType);
  }

  const search = filters.query?.trim().toLowerCase();
  if (search) {
    events = events.filter((event) => {
      const haystack = [
        event.summary,
        event.actor.email,
        event.actor.displayName,
        event.resource.id,
        event.resource.slug,
        event.resource.type,
        event.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const lastDoc = snap.docs[snap.docs.length - 1];

  return {
    events,
    nextCursor: snap.docs.length === limit && lastDoc ? lastDoc.id : null,
  };
}

/**
 * @param {string} eventId
 */
export async function getAuditEventAdmin(eventId) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const id = eventId?.trim();
  if (!id) throw new Error("eventId is required");

  const eventSnap = await db.collection(COLLECTIONS.auditEvents).doc(id).get();
  if (!eventSnap.exists) throw new Error("Audit event not found");

  const event = normalizeAuditEvent({ id: eventSnap.id, ...eventSnap.data() });
  const snapshotsSnap = await eventSnap.ref.collection(AUDIT_SNAPSHOTS_SUBCOLLECTION).get();

  /** @type {Record<string, unknown>} */
  const snapshots = {};
  for (const snap of snapshotsSnap.docs) {
    const payload = snap.data();
    snapshots[snap.id] = payload?.data ?? payload;
  }

  return { event, snapshots };
}
