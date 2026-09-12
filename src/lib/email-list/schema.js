/**
 * Emailing list — pure helpers shared by the admin UI, the API routes, and the
 * server sender. Everything here stays free of Firestore and Mailgun so it can
 * be unit tested and imported from the browser.
 */

/** @typedef {'subscribed' | 'unsubscribed' | 'bounced'} EmailSubscriberStatus */

/** @typedef {'admin' | 'import' | 'signup'} EmailSubscriberSource */

/** @typedef {'newsletter' | 'bulletin'} EmailCampaignKind */

/** @typedef {'sending' | 'sent' | 'partial' | 'failed'} EmailCampaignStatus */

/**
 * @typedef {object} EmailSubscriber
 * @property {string} email
 * @property {string} name
 * @property {EmailSubscriberStatus} status
 * @property {EmailSubscriberSource} source
 * @property {string} unsubscribeToken Random per-subscriber secret used by the unsubscribe link.
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} unsubscribedAt
 * @property {string} lastSentAt
 * @property {string} note
 */

/**
 * @typedef {object} EmailCampaignAttachment
 * @property {string} name
 * @property {string} url
 * @property {string} mimeType
 * @property {number} sizeBytes
 */

/**
 * @typedef {object} EmailCampaignBatch
 * @property {string} messageId
 * @property {number} recipientCount
 * @property {string} error
 */

/**
 * @typedef {object} EmailCampaign
 * @property {string} subject
 * @property {string} html Sanitized rich-text body as composed by the admin.
 * @property {EmailCampaignKind} kind
 * @property {EmailCampaignStatus} status
 * @property {EmailCampaignAttachment[]} attachments
 * @property {string} bulletinId
 * @property {string} bulletinUrl
 * @property {number} recipientCount
 * @property {number} sentCount
 * @property {number} failedCount
 * @property {EmailCampaignBatch[]} batches
 * @property {string} error
 * @property {string} sentAt
 * @property {string} sentBy
 */

export const EMAIL_SUBSCRIBER_STATUSES = /** @type {const} */ ([
  "subscribed",
  "unsubscribed",
  "bounced",
]);

export const EMAIL_SUBSCRIBER_SOURCES = /** @type {const} */ (["admin", "import", "signup"]);

export const EMAIL_CAMPAIGN_KINDS = /** @type {const} */ (["newsletter", "bulletin"]);

export const EMAIL_CAMPAIGN_STATUSES = /** @type {const} */ ([
  "sending",
  "sent",
  "partial",
  "failed",
]);

/**
 * Mailgun accepts up to 1,000 recipients in one batch send. Staying under it
 * leaves room for the per-recipient variables that carry unsubscribe links.
 */
export const MAX_RECIPIENTS_PER_BATCH = 900;

/** Mailgun rejects messages above 25 MB; keep well clear of the ceiling. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const MAX_SUBJECT_LENGTH = 200;

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const NAMED_ADDRESS_RE = /^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/;

/**
 * @param {unknown} value
 * @returns {string}
 */
function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeEmail(value) {
  return str(value).toLowerCase();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
}

/**
 * Firestore document ids may not contain `/`. Email addresses are otherwise
 * safe, so keying subscribers by address makes repeat imports idempotent.
 *
 * @param {string} email
 * @returns {string}
 */
export function subscriberDocId(email) {
  return normalizeEmail(email).replace(/\//g, "_");
}

/**
 * @param {unknown} value
 * @returns {EmailSubscriberStatus}
 */
export function normalizeSubscriberStatus(value) {
  const status = str(value).toLowerCase();
  switch (status) {
    case "subscribed":
    case "unsubscribed":
    case "bounced":
      return status;
    default:
      return "subscribed";
  }
}

/**
 * @param {EmailSubscriberStatus} status
 * @returns {string}
 */
export function subscriberStatusLabel(status) {
  switch (status) {
    case "subscribed":
      return "Subscribed";
    case "unsubscribed":
      return "Unsubscribed";
    case "bounced":
      return "Bounced";
    default:
      return status;
  }
}

/**
 * @param {unknown} value
 * @returns {EmailSubscriberSource}
 */
export function normalizeSubscriberSource(value) {
  const source = str(value).toLowerCase();
  switch (source) {
    case "admin":
    case "import":
    case "signup":
      return source;
    default:
      return "admin";
  }
}

/**
 * @param {unknown} raw
 * @returns {EmailSubscriber}
 */
export function normalizeSubscriber(raw) {
  const s = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    email: normalizeEmail(s.email),
    name: str(s.name),
    status: normalizeSubscriberStatus(s.status),
    source: normalizeSubscriberSource(s.source),
    unsubscribeToken: str(s.unsubscribeToken),
    createdAt: str(s.createdAt),
    updatedAt: str(s.updatedAt),
    unsubscribedAt: str(s.unsubscribedAt),
    lastSentAt: str(s.lastSentAt),
    note: str(s.note),
  };
}

/**
 * Parse whatever an admin pastes into the "add people" box: one address per
 * line, comma or semicolon separated, and `Name <address>` pairs all work.
 *
 * @param {unknown} input
 * @returns {{ entries: Array<{ email: string, name: string }>, invalid: string[] }}
 */
export function parseSubscriberInput(input) {
  const text = typeof input === "string" ? input : "";
  /** @type {Map<string, { email: string, name: string }>} */
  const entries = new Map();
  /** @type {string[]} */
  const invalid = [];

  for (const line of text.split(/[\n\r]+/)) {
    // A line may hold several plain addresses, but `Name <addr>` pairs must
    // survive the split, so only break on separators outside angle brackets.
    for (const chunk of line.split(/,(?![^<]*>)|;(?![^<]*>)|\t/)) {
      const candidate = chunk.trim();
      if (!candidate) continue;

      const named = candidate.match(NAMED_ADDRESS_RE);
      const email = normalizeEmail(named ? named[2] : candidate);
      const name = named ? named[1].replace(/^"|"$/g, "").trim() : "";

      if (!isValidEmail(email)) {
        invalid.push(candidate);
        continue;
      }

      const existing = entries.get(email);
      entries.set(email, { email, name: name || existing?.name || "" });
    }
  }

  return { entries: [...entries.values()], invalid };
}

/**
 * @param {unknown} value
 * @returns {EmailCampaignKind}
 */
export function normalizeCampaignKind(value) {
  const kind = str(value).toLowerCase();
  switch (kind) {
    case "newsletter":
    case "bulletin":
      return kind;
    default:
      return "newsletter";
  }
}

/**
 * @param {unknown} value
 * @returns {EmailCampaignStatus}
 */
export function normalizeCampaignStatus(value) {
  const status = str(value).toLowerCase();
  switch (status) {
    case "sending":
    case "sent":
    case "partial":
    case "failed":
      return status;
    default:
      return "sending";
  }
}

/**
 * @param {EmailCampaignStatus} status
 * @returns {string}
 */
export function campaignStatusLabel(status) {
  switch (status) {
    case "sending":
      return "Sending";
    case "sent":
      return "Sent";
    case "partial":
      return "Partly sent";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

/**
 * @param {unknown} raw
 * @returns {EmailCampaignAttachment}
 */
export function normalizeAttachment(raw) {
  const a = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    name: str(a.name) || "attachment",
    url: str(a.url),
    mimeType: str(a.mimeType),
    sizeBytes: num(a.sizeBytes),
  };
}

/**
 * @param {unknown} raw
 * @returns {EmailCampaign}
 */
export function normalizeCampaign(raw) {
  const c = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const attachments = Array.isArray(c.attachments) ? c.attachments.map(normalizeAttachment) : [];
  const batches = Array.isArray(c.batches)
    ? c.batches.map((batch) => {
        const b =
          batch && typeof batch === "object" ? /** @type {Record<string, unknown>} */ (batch) : {};
        return {
          messageId: str(b.messageId),
          recipientCount: num(b.recipientCount),
          error: str(b.error),
        };
      })
    : [];

  return {
    subject: str(c.subject),
    html: typeof c.html === "string" ? c.html : "",
    kind: normalizeCampaignKind(c.kind),
    status: normalizeCampaignStatus(c.status),
    attachments: attachments.filter((a) => a.url),
    bulletinId: str(c.bulletinId),
    bulletinUrl: str(c.bulletinUrl),
    recipientCount: num(c.recipientCount),
    sentCount: num(c.sentCount),
    failedCount: num(c.failedCount),
    batches,
    error: str(c.error),
    sentAt: str(c.sentAt),
    sentBy: str(c.sentBy),
  };
}

/**
 * Validate what the composer submitted before anything touches Mailgun.
 *
 * @param {{ subject?: unknown, html?: unknown, attachments?: unknown }} input
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateCampaignInput(input) {
  const subject = str(input.subject);
  if (!subject) {
    return { ok: false, error: "Enter a subject line." };
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { ok: false, error: `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.` };
  }

  const html = typeof input.html === "string" ? input.html : "";
  const attachments = Array.isArray(input.attachments)
    ? input.attachments.map(normalizeAttachment)
    : [];
  const hasBody = html.replace(/<[^>]*>/g, "").trim().length > 0 || /<img\b/i.test(html);

  if (!hasBody && attachments.length === 0) {
    return { ok: false, error: "Write a message before sending." };
  }

  for (const attachment of attachments) {
    if (!attachment.url) {
      return { ok: false, error: `Attachment "${attachment.name}" is missing a file URL.` };
    }
  }

  const totalBytes = attachments.reduce((sum, a) => sum + a.sizeBytes, 0);
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `Attachments total ${formatBytes(totalBytes)}. Keep them under ${formatBytes(
        MAX_TOTAL_ATTACHMENT_BYTES,
      )} — link to large files instead.`,
    };
  }

  return { ok: true };
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} [size]
 * @returns {T[][]}
 */
export function chunkRecipients(items, size = MAX_RECIPIENTS_PER_BATCH) {
  const limit = Math.max(1, Math.floor(size));
  /** @type {T[][]} */
  const chunks = [];
  for (let i = 0; i < items.length; i += limit) {
    chunks.push(items.slice(i, i + limit));
  }
  return chunks;
}

/**
 * @param {EmailSubscriber[]} subscribers
 * @returns {{ total: number, subscribed: number, unsubscribed: number, bounced: number }}
 */
export function summarizeSubscribers(subscribers) {
  const summary = { total: 0, subscribed: 0, unsubscribed: 0, bounced: 0 };
  for (const subscriber of subscribers) {
    summary.total += 1;
    switch (subscriber.status) {
      case "subscribed":
        summary.subscribed += 1;
        break;
      case "unsubscribed":
        summary.unsubscribed += 1;
        break;
      case "bounced":
        summary.bounced += 1;
        break;
      default:
        break;
    }
  }
  return summary;
}

/**
 * @param {{ sentCount: number, failedCount: number }} counts
 * @returns {EmailCampaignStatus}
 */
export function campaignStatusFromCounts({ sentCount, failedCount }) {
  if (sentCount > 0 && failedCount > 0) return "partial";
  if (sentCount > 0) return "sent";
  return "failed";
}

/**
 * @param {string} baseUrl Public site origin, e.g. `https://www.yourparish.org`.
 * @param {string} token
 * @returns {string}
 */
export function buildUnsubscribeUrl(baseUrl, token) {
  const origin = str(baseUrl).replace(/\/+$/, "");
  return `${origin}/api/email-list/unsubscribe?token=${encodeURIComponent(token)}`;
}
