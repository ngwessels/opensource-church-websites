/**
 * Mailgun delivery event helpers — pure functions shared by the inbound webhook
 * route and the admin UI.
 */

/**
 * @typedef {'accepted' | 'rejected' | 'delivered' | 'opened' | 'clicked'
 *   | 'unsubscribed' | 'complained' | 'failed' | 'stored'} EmailEventType
 */

/** @typedef {'form_notification' | 'prayer_digest' | 'user_invite' | 'test' | 'other'} EmailMessageKind */

/**
 * @typedef {object} EmailEvent
 * @property {string} id Mailgun event id — used to make webhook delivery idempotent.
 * @property {EmailEventType} type
 * @property {string} messageId
 * @property {string} recipient
 * @property {string} timestamp ISO string.
 * @property {string} reason
 * @property {string} severity
 * @property {string} description
 * @property {number | null} code
 * @property {string} url Clicked URL, for `clicked` events.
 * @property {string[]} tags
 */

export const EMAIL_EVENT_TYPES = /** @type {const} */ ([
  "accepted",
  "rejected",
  "delivered",
  "opened",
  "clicked",
  "unsubscribed",
  "complained",
  "failed",
  "stored",
]);

export const EMAIL_MESSAGE_KINDS = /** @type {const} */ ([
  "form_notification",
  "prayer_digest",
  "user_invite",
  "test",
  "other",
]);

/**
 * Mailgun webhook ids we register. `opened` and `clicked` only fire when
 * tracking is enabled on the domain or the individual message.
 */
export const MAILGUN_WEBHOOK_IDS = /** @type {const} */ ([
  "accepted",
  "delivered",
  "opened",
  "clicked",
  "permanent_fail",
  "temporary_fail",
  "unsubscribed",
  "complained",
]);

export const EMAIL_EVENT_LABELS = {
  accepted: "Accepted",
  rejected: "Rejected",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  unsubscribed: "Unsubscribed",
  complained: "Marked as spam",
  failed: "Failed",
  stored: "Stored",
  queued: "Queued",
};

/**
 * Ranking used to pick the headline status for a message. Events can arrive out
 * of order, so the highest-ranked event seen always wins.
 *
 * @param {EmailEventType} type
 * @returns {number}
 */
export function emailEventRank(type) {
  switch (type) {
    case "rejected":
      return 55;
    case "accepted":
      return 10;
    case "stored":
      return 15;
    case "delivered":
      return 20;
    case "opened":
      return 30;
    case "clicked":
      return 40;
    case "unsubscribed":
      return 45;
    case "complained":
      return 50;
    case "failed":
      return 60;
    default:
      return 0;
  }
}

/**
 * Mailgun sends `<id@domain>` from the messages API and a bare `id@domain` in
 * webhooks. Normalize so both sides agree on the document key.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeMessageId(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^<|>$/g, "").toLowerCase();
}

/**
 * Firestore document ids cannot contain `/`; message ids never should, but be safe.
 *
 * @param {string} messageId
 * @returns {string}
 */
export function messageDocId(messageId) {
  return normalizeMessageId(messageId).replace(/\//g, "_");
}

/**
 * @param {unknown} value
 * @returns {EmailEventType | null}
 */
function normalizeEventType(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (raw) {
    case "accepted":
    case "rejected":
    case "delivered":
    case "opened":
    case "clicked":
    case "unsubscribed":
    case "complained":
    case "failed":
    case "stored":
      return raw;
    // Legacy webhook payloads and webhook ids use slightly different names.
    case "unsubscribe":
      return "unsubscribed";
    case "complaint":
      return "complained";
    case "permanent_fail":
    case "temporary_fail":
    case "bounced":
    case "dropped":
      return "failed";
    default:
      return null;
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function timestampToIso(value) {
  const seconds = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalize a Mailgun webhook body into the record we store.
 *
 * Supports the current JSON payload (`{ signature, "event-data": {...} }`) and
 * the legacy form-encoded payload.
 *
 * @param {unknown} body
 * @returns {{ ok: true, event: EmailEvent } | { ok: false, error: string }}
 */
export function normalizeMailgunWebhookEvent(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Webhook payload is not an object." };
  }

  const payload = /** @type {Record<string, any>} */ (body);
  const data = payload["event-data"] && typeof payload["event-data"] === "object"
    ? /** @type {Record<string, any>} */ (payload["event-data"])
    : payload;

  const type = normalizeEventType(data.event);
  if (!type) {
    return { ok: false, error: `Unsupported Mailgun event: ${String(data.event ?? "unknown")}` };
  }

  const headers = data.message?.headers && typeof data.message.headers === "object"
    ? /** @type {Record<string, any>} */ (data.message.headers)
    : {};

  const messageId = normalizeMessageId(
    headers["message-id"] ?? data["message-id"] ?? data["Message-Id"] ?? data.messageId ?? "",
  );

  if (!messageId) {
    return { ok: false, error: "Webhook payload has no message id." };
  }

  const deliveryStatus = data["delivery-status"] && typeof data["delivery-status"] === "object"
    ? /** @type {Record<string, any>} */ (data["delivery-status"])
    : {};

  const code = Number(deliveryStatus.code ?? data.code);

  return {
    ok: true,
    event: {
      id: str(data.id) || `${messageId}:${type}:${str(data.timestamp) || Date.now()}`,
      type,
      messageId,
      recipient: str(data.recipient).toLowerCase(),
      timestamp: timestampToIso(data.timestamp),
      reason: str(data.reason),
      severity: str(data.severity),
      description: str(deliveryStatus.description) || str(deliveryStatus.message),
      code: Number.isFinite(code) ? code : null,
      url: str(data.url),
      tags: Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === "string") : [],
    },
  };
}

/**
 * @typedef {object} EmailMessageStatus
 * @property {string} status
 * @property {number} statusRank
 * @property {string} lastEventAt
 * @property {string} [acceptedAt]
 * @property {string} [deliveredAt]
 * @property {string} [openedAt]
 * @property {string} [clickedAt]
 * @property {string} [failedAt]
 * @property {string} [complainedAt]
 * @property {string} [unsubscribedAt]
 * @property {number} [openCount]
 * @property {number} [clickCount]
 * @property {string} [failureReason]
 */

/**
 * Fold an event into a message's status fields. Pure so the ordering rules can
 * be tested without Firestore.
 *
 * @param {Record<string, any> | null | undefined} message
 * @param {EmailEvent} event
 * @returns {EmailMessageStatus}
 */
export function applyEventToMessageStatus(message, event) {
  const current = message && typeof message === "object" ? message : {};
  const currentRank = Number(current.statusRank);
  const rank = emailEventRank(event.type);

  /** @type {EmailMessageStatus} */
  const patch = {
    status: Number.isFinite(currentRank) && currentRank >= rank ? String(current.status) : event.type,
    statusRank: Number.isFinite(currentRank) && currentRank >= rank ? currentRank : rank,
    lastEventAt: event.timestamp,
  };

  switch (event.type) {
    case "accepted":
      patch.acceptedAt = event.timestamp;
      break;
    case "delivered":
      patch.deliveredAt = event.timestamp;
      break;
    case "opened":
      patch.openedAt = current.openedAt ? String(current.openedAt) : event.timestamp;
      patch.openCount = toCount(current.openCount) + 1;
      break;
    case "clicked":
      patch.clickedAt = current.clickedAt ? String(current.clickedAt) : event.timestamp;
      patch.clickCount = toCount(current.clickCount) + 1;
      break;
    case "failed":
    case "rejected":
      patch.failedAt = event.timestamp;
      patch.failureReason = event.description || event.reason || event.severity || "";
      break;
    case "complained":
      patch.complainedAt = event.timestamp;
      break;
    case "unsubscribed":
      patch.unsubscribedAt = event.timestamp;
      break;
    case "stored":
      break;
    default:
      break;
  }

  return patch;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @param {unknown} value
 * @returns {EmailMessageKind}
 */
export function normalizeMessageKind(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /** @type {EmailMessageKind[]} */ (EMAIL_MESSAGE_KINDS).includes(
    /** @type {EmailMessageKind} */ (raw),
  )
    ? /** @type {EmailMessageKind} */ (raw)
    : "other";
}

/**
 * @param {string} status
 * @returns {string}
 */
export function emailStatusLabel(status) {
  return EMAIL_EVENT_LABELS[/** @type {keyof typeof EMAIL_EVENT_LABELS} */ (status)] || status;
}
