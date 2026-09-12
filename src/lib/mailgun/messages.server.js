import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

import {
  applyEventToMessageStatus,
  applyEventToRecipientStatuses,
  buildInitialRecipientStatuses,
  expandEmailMessagesForAdmin,
  messageDocId,
  normalizeMessageId,
  normalizeMessageKind,
  normalizeRecipientEmail,
  summarizeDeliveryStats,
  summarizeRecipientStatuses,
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

  const recipients = Array.isArray(to) ? to.map(normalizeRecipientEmail).filter(Boolean) : [];
  const recipientStatuses =
    recipients.length > 1 ? buildInitialRecipientStatuses(recipients) : undefined;

  try {
    await db
      .collection(COLLECTIONS.emailMessages)
      .doc(id)
      .set(
        {
          messageId: normalizeMessageId(messageId),
          to: recipients.length > 0 ? recipients : to,
          subject,
          kind: normalizeMessageKind(kind),
          from,
          domain,
          status: "queued",
          statusRank: 0,
          sentAt: new Date().toISOString(),
          ...(recipientStatuses ? { recipientStatuses } : {}),
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
    const recipients = Array.isArray(message?.to) ? message.to.map(normalizeRecipientEmail).filter(Boolean) : [];
    const trackPerRecipient = Boolean(event.recipient) && recipients.length > 1;
    const recipientStatuses = trackPerRecipient
      ? applyEventToRecipientStatuses(
          message?.recipientStatuses && typeof message.recipientStatuses === "object"
            ? message.recipientStatuses
            : buildInitialRecipientStatuses(recipients),
          event,
        )
      : undefined;
    const statusPatch = trackPerRecipient
      ? summarizeRecipientStatuses(recipientStatuses)
      : applyEventToMessageStatus(message, event);

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
        ...(recipientStatuses ? { recipientStatuses } : {}),
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
  const sorted = kind
    ? rows.sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")))
    : rows;
  const withStatuses = await backfillRecipientStatuses(sorted);
  return expandEmailMessagesForAdmin(withStatuses);
}

/**
 * Rebuild per-recipient status for older bulk sends that predate recipientStatuses.
 *
 * @param {Array<Record<string, any>>} messages
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function backfillRecipientStatuses(messages) {
  const db = getFirebaseAdminFirestore();
  if (!db) return messages;

  const needsBackfill = messages.filter(
    (message) =>
      Array.isArray(message.to) &&
      message.to.length > 1 &&
      (!message.recipientStatuses || Object.keys(message.recipientStatuses).length === 0),
  );
  if (needsBackfill.length === 0) return messages;

  const eventsByMessageId = await loadEventsGroupedByMessageId(
    needsBackfill.map((message) => String(message.messageId || "")).filter(Boolean),
  );

  return messages.map((message) => {
    if (
      !Array.isArray(message.to) ||
      message.to.length <= 1 ||
      (message.recipientStatuses && Object.keys(message.recipientStatuses).length > 0)
    ) {
      return message;
    }

    const events = eventsByMessageId.get(normalizeMessageId(String(message.messageId || ""))) || [];
    if (events.length === 0) return message;

    let recipientStatuses = buildInitialRecipientStatuses(message.to);
    for (const stored of events) {
      recipientStatuses = applyEventToRecipientStatuses(recipientStatuses, storedEventToEmailEvent(stored));
    }

    return { ...message, recipientStatuses };
  });
}

/**
 * @param {string[]} messageIds
 * @returns {Promise<Map<string, Array<Record<string, unknown>>>>}
 */
async function loadEventsGroupedByMessageId(messageIds) {
  const db = getFirebaseAdminFirestore();
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const grouped = new Map();
  if (!db || messageIds.length === 0) return grouped;

  const uniqueIds = [...new Set(messageIds.map((id) => normalizeMessageId(id)).filter(Boolean))];
  for (let index = 0; index < uniqueIds.length; index += 30) {
    const chunk = uniqueIds.slice(index, index + 30);
    const snap = await db.collection(COLLECTIONS.emailEvents).where("messageId", "in", chunk).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const key = normalizeMessageId(String(data.messageId || ""));
      if (!key) continue;
      const list = grouped.get(key) || [];
      list.push(data);
      grouped.set(key, list);
    }
  }

  for (const [key, events] of grouped) {
    events.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
    grouped.set(key, events);
  }

  return grouped;
}

/**
 * @param {Record<string, unknown>} stored
 * @returns {import('./events.js').EmailEvent}
 */
function storedEventToEmailEvent(stored) {
  return {
    id: String(stored.eventId || stored.id || ""),
    type: /** @type {import('./events.js').EmailEvent['type']} */ (stored.type),
    messageId: normalizeMessageId(String(stored.messageId || "")),
    recipient: normalizeRecipientEmail(String(stored.recipient || "")),
    timestamp: String(stored.timestamp || ""),
    reason: String(stored.reason || ""),
    severity: String(stored.severity || ""),
    description: String(stored.description || ""),
    code: typeof stored.code === "number" ? stored.code : null,
    url: String(stored.url || ""),
    tags: Array.isArray(stored.tags) ? stored.tags.filter((tag) => typeof tag === "string") : [],
  };
}

/**
 * Per-recipient delivery stats for one list or bulletin campaign.
 *
 * @param {string} campaignId
 * @returns {Promise<{
 *   campaignId: string,
 *   summary: ReturnType<typeof summarizeDeliveryStats>,
 *   recipients: Array<{
 *     email: string,
 *     status: string,
 *     deliveredAt: string,
 *     openedAt: string,
 *     clickedAt: string,
 *     lastEventAt: string,
 *     failureReason: string,
 *   }>,
 * } | null>}
 */
export async function getCampaignDeliveryReport(campaignId) {
  const db = getFirebaseAdminFirestore();
  const id = typeof campaignId === "string" ? campaignId.trim() : "";
  if (!db || !id) return null;

  const snap = await db.collection(COLLECTIONS.emailMessages).where("context.campaignId", "==", id).get();
  const messages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const withStatuses = await backfillRecipientStatuses(messages);
  const expanded = expandEmailMessagesForAdmin(withStatuses);

  const recipients = expanded
    .map((row) => ({
      email: Array.isArray(row.to) ? String(row.to[0] || "") : "",
      status: String(row.status || "queued"),
      deliveredAt: row.deliveredAt ? String(row.deliveredAt) : "",
      openedAt: row.openedAt ? String(row.openedAt) : "",
      clickedAt: row.clickedAt ? String(row.clickedAt) : "",
      lastEventAt: row.lastEventAt ? String(row.lastEventAt) : "",
      failureReason: row.failureReason ? String(row.failureReason) : "",
    }))
    .filter((row) => row.email);

  return {
    campaignId: id,
    summary: summarizeDeliveryStats(recipients),
    recipients,
  };
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
