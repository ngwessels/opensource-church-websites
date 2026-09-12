import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

import {
  applyEventToMessageStatus,
  messageDocId,
  normalizeMessageId,
  normalizeMessageKind,
} from "./events.js";

/**
 * @typedef {import('./events.js').EmailEvent} EmailEvent
 * @typedef {import('./events.js').EmailMessageKind} EmailMessageKind
 */

/**
 * Record a message we handed to Mailgun. Delivery status is filled in later by
 * the webhook; until then the message sits at `queued`.
 *
 * @param {{
 *   messageId: string,
 *   to: string[],
 *   subject: string,
 *   kind: EmailMessageKind,
 *   from: string,
 *   domain: string,
 *   context?: Record<string, string>,
 * }} input
 * @returns {Promise<void>}
 */
export async function recordSentMessage({ messageId, to, subject, kind, from, domain, context }) {
  const db = getFirebaseAdminFirestore();
  const id = messageDocId(messageId);
  if (!db || !id) return;

  try {
    await db
      .collection(COLLECTIONS.emailMessages)
      .doc(id)
      .set(
        {
          messageId: normalizeMessageId(messageId),
          to,
          subject,
          kind: normalizeMessageKind(kind),
          from,
          domain,
          status: "queued",
          statusRank: 0,
          sentAt: new Date().toISOString(),
          ...(context ? { context } : {}),
        },
        { merge: true },
      );
  } catch (err) {
    // Never fail a send because we could not write the audit trail.
    console.warn("[mailgun] Could not record sent message:", err instanceof Error ? err.message : err);
  }
}

/**
 * Store a webhook event and fold it into its message's status.
 *
 * Writes are idempotent: Mailgun retries deliver the same event id, and the
 * status fold only ever moves a message forward.
 *
 * @param {EmailEvent} event
 * @returns {Promise<{ recorded: boolean, duplicate: boolean }>}
 */
export async function recordMailgunEvent(event) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const eventRef = db.collection(COLLECTIONS.emailEvents).doc(eventDocId(event));
  const messageRef = db.collection(COLLECTIONS.emailMessages).doc(messageDocId(event.messageId));

  return db.runTransaction(async (tx) => {
    const [eventSnap, messageSnap] = await Promise.all([tx.get(eventRef), tx.get(messageRef)]);

    if (eventSnap.exists) {
      return { recorded: false, duplicate: true };
    }

    tx.set(eventRef, {
      eventId: event.id,
      type: event.type,
      messageId: event.messageId,
      recipient: event.recipient,
      timestamp: event.timestamp,
      reason: event.reason,
      severity: event.severity,
      description: event.description,
      code: event.code,
      url: event.url,
      tags: event.tags,
      receivedAt: new Date().toISOString(),
    });

    const message = messageSnap.exists ? messageSnap.data() : null;
    const statusPatch = applyEventToMessageStatus(message, event);

    tx.set(
      messageRef,
      {
        messageId: event.messageId,
        ...(message
          ? {}
          : {
              // The message was sent before this integration existed, or by
              // another app on the same Mailgun domain.
              to: event.recipient ? [event.recipient] : [],
              subject: "",
              kind: "other",
              sentAt: event.timestamp,
            }),
        ...statusPatch,
      },
      { merge: true },
    );

    return { recorded: true, duplicate: false };
  });
}

/**
 * @param {EmailEvent} event
 * @returns {string}
 */
function eventDocId(event) {
  return `${messageDocId(event.messageId)}__${event.type}__${event.id}`.slice(0, 1500).replace(/\//g, "_");
}

/**
 * Recent messages for the admin activity table.
 *
 * @param {{ limit?: number, kind?: string }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listRecentEmailMessages({ limit = 50, kind } = {}) {
  const db = getFirebaseAdminFirestore();
  if (!db) return [];

  let query = db.collection(COLLECTIONS.emailMessages).orderBy("sentAt", "desc").limit(limit);
  if (kind) query = db.collection(COLLECTIONS.emailMessages).where("kind", "==", kind).limit(limit);

  const snap = await query.get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return kind
    ? rows.sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")))
    : rows;
}

/**
 * @param {string} messageId
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listEventsForMessage(messageId, { limit = 50 } = {}) {
  const db = getFirebaseAdminFirestore();
  if (!db) return [];

  const snap = await db
    .collection(COLLECTIONS.emailEvents)
    .where("messageId", "==", normalizeMessageId(messageId))
    .limit(limit)
    .get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
}
