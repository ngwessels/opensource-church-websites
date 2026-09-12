import "server-only";

import { recordAuditEvent } from "@/lib/audit/record.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { fetchAttachment, sendMailgunBatch } from "@/lib/mailgun/bulk.server";
import { getMailgunConfig } from "@/lib/mailgun/settings.server";
import { getSiteBaseUrl } from "@/lib/seo/site-url";

import { renderCampaignEmail, sanitizeEmailHtml } from "./html.js";
import {
  buildUnsubscribeUrl,
  campaignStatusFromCounts,
  chunkRecipients,
  MAX_TOTAL_ATTACHMENT_BYTES,
  normalizeAttachment,
  normalizeCampaign,
  normalizeCampaignKind,
} from "./schema.js";
import { listSendableSubscribers, markSubscribersSent } from "./subscribers.server.js";

/**
 * @typedef {import('./schema.js').EmailCampaign} EmailCampaign
 * @typedef {import('./schema.js').EmailCampaignAttachment} EmailCampaignAttachment
 * @typedef {import('./schema.js').EmailCampaignKind} EmailCampaignKind
 * @typedef {import('@/lib/audit/schema.js').AuditActor} AuditActor
 * @typedef {import('@/lib/audit/schema.js').AuditSource} AuditSource
 * @typedef {import('@/lib/mailgun/events.js').EmailMessageKind} EmailMessageKind
 */

/**
 * Mailgun substitutes recipient variables at delivery time, so one batch can
 * carry a personal unsubscribe link for every address.
 */
const UNSUBSCRIBE_VARIABLE = "%recipient.unsubscribe_url%";

const AUDIT_CONTEXT = { builderPath: "/builder/admin/email-list", section: "emailList" };

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

function generateCampaignId() {
  return `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {EmailCampaignKind} kind
 * @returns {EmailMessageKind}
 */
function messageKindFor(kind) {
  switch (kind) {
    case "bulletin":
      return "bulletin_campaign";
    case "newsletter":
      return "list_campaign";
    default:
      return "list_campaign";
  }
}

async function readSiteConfig() {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  const snap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  return snap.exists ? snap.data() : null;
}

/**
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<EmailCampaign & { id: string }>>}
 */
export async function listCampaigns({ limit = 25 } = {}) {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.emailCampaigns)
    .orderBy("sentAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...normalizeCampaign(doc.data()) }));
}

/**
 * Download every attachment once, up front, so a failure is reported before
 * any subscriber receives a partial send.
 *
 * @param {EmailCampaignAttachment[]} attachments
 * @returns {Promise<import('@/lib/mailgun/bulk.server.js').BulkAttachment[]>}
 */
async function loadAttachments(attachments) {
  /** @type {import('@/lib/mailgun/bulk.server.js').BulkAttachment[]} */
  const loaded = [];
  let total = 0;

  for (const attachment of attachments) {
    const file = await fetchAttachment(
      { url: attachment.url, name: attachment.name, mimeType: attachment.mimeType },
      { maxBytes: MAX_TOTAL_ATTACHMENT_BYTES },
    );
    total += file.data.byteLength;
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new Error("Attachments are too large to email. Link to the files instead.");
    }
    loaded.push(file);
  }

  return loaded;
}

/**
 * Send a composed message to one address without touching the list or the
 * campaign history — the preview an admin sends to themselves first.
 *
 * @param {{
 *   to: string,
 *   subject: string,
 *   bodyHtml: string,
 *   attachments?: EmailCampaignAttachment[],
 * }} input
 * @returns {Promise<{ sent: boolean, messageId: string, error: string }>}
 */
export async function sendCampaignTest({ to, subject, bodyHtml, attachments = [] }) {
  const config = await getMailgunConfig();
  if (!config.configured) {
    throw new Error("Mailgun is not configured.");
  }

  const siteConfig = await readSiteConfig();
  const siteUrl = getSiteBaseUrl(siteConfig);
  const siteName = typeof siteConfig?.name === "string" && siteConfig.name ? siteConfig.name : "Our Parish";

  const { html, text } = renderCampaignEmail({
    siteName,
    subject,
    bodyHtml,
    siteUrl,
    unsubscribeUrl: buildUnsubscribeUrl(siteUrl, "test-token"),
    footerNote: "Test send — the list was not emailed.",
  });

  const files = await loadAttachments(attachments.map(normalizeAttachment));
  const result = await sendMailgunBatch({
    recipients: [{ email: to }],
    subject,
    html,
    text,
    kind: "test",
    attachments: files,
    context: { campaignTest: "true" },
    config,
  });

  return { sent: Boolean(result.messageId), messageId: result.messageId, error: result.error };
}

/**
 * Email everyone currently subscribed and record the result.
 *
 * Sending requires Mailgun; without it this throws so the caller can show the
 * "connect Mailgun first" message rather than silently dropping the send.
 *
 * @param {{
 *   subject: string,
 *   bodyHtml: string,
 *   kind?: EmailCampaignKind,
 *   attachments?: EmailCampaignAttachment[],
 *   bulletinId?: string,
 *   bulletinUrl?: string,
 *   actor?: AuditActor,
 *   auditSource?: AuditSource,
 * }} input
 * @returns {Promise<EmailCampaign & { id: string }>}
 */
export async function sendCampaign({
  subject,
  bodyHtml,
  kind = "newsletter",
  attachments = [],
  bulletinId = "",
  bulletinUrl = "",
  actor,
  auditSource,
}) {
  const config = await getMailgunConfig();
  if (!config.configured) {
    throw new Error("Mailgun is not configured. Connect it under Admin → Email to send email.");
  }

  const recipients = await listSendableSubscribers();
  if (recipients.length === 0) {
    throw new Error("Nobody is subscribed to the email list yet.");
  }

  const db = getDb();
  const siteConfig = await readSiteConfig();
  const siteUrl = getSiteBaseUrl(siteConfig);
  const siteName = typeof siteConfig?.name === "string" && siteConfig.name ? siteConfig.name : "Our Parish";

  const campaignKind = normalizeCampaignKind(kind);
  const normalizedAttachments = attachments.map(normalizeAttachment).filter((a) => a.url);
  const files = await loadAttachments(normalizedAttachments);
  const safeBody = sanitizeEmailHtml(bodyHtml);

  const { html, text } = renderCampaignEmail({
    siteName,
    subject,
    bodyHtml: safeBody,
    siteUrl,
    unsubscribeUrl: UNSUBSCRIBE_VARIABLE,
  });

  const campaignId = generateCampaignId();
  const ref = db.collection(COLLECTIONS.emailCampaigns).doc(campaignId);
  const startedAt = now();

  await ref.set({
    subject,
    html: safeBody,
    kind: campaignKind,
    status: "sending",
    attachments: normalizedAttachments,
    bulletinId,
    bulletinUrl,
    recipientCount: recipients.length,
    sentCount: 0,
    failedCount: 0,
    batches: [],
    error: "",
    sentAt: startedAt,
    sentBy: actor?.email || "",
  });

  /** @type {Array<{ messageId: string, recipientCount: number, error: string }>} */
  const batches = [];
  /** @type {string[]} */
  const sentSubscriberIds = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const chunk of chunkRecipients(recipients)) {
    const result = await sendMailgunBatch({
      recipients: chunk.map((subscriber) => ({
        email: subscriber.email,
        variables: {
          unsubscribe_url: buildUnsubscribeUrl(siteUrl, subscriber.unsubscribeToken),
          name: subscriber.name,
        },
      })),
      subject,
      html,
      text,
      kind: messageKindFor(campaignKind),
      attachments: files,
      listUnsubscribeUrl: UNSUBSCRIBE_VARIABLE,
      context: {
        campaignId,
        campaignKind,
        ...(bulletinId ? { bulletinId } : {}),
      },
      config,
    });

    batches.push(result);

    if (result.error) {
      failedCount += chunk.length;
    } else {
      sentCount += chunk.length;
      sentSubscriberIds.push(...chunk.map((subscriber) => subscriber.id));
    }
  }

  const status = campaignStatusFromCounts({ sentCount, failedCount });
  const error = batches
    .map((batch) => batch.error)
    .filter(Boolean)
    .join("; ");

  await ref.update({ status, sentCount, failedCount, batches, error });

  if (sentSubscriberIds.length > 0) {
    await markSubscribersSent(sentSubscriberIds);
  }

  const snap = await ref.get();
  const campaign = { id: campaignId, ...normalizeCampaign(snap.data()) };

  await recordAuditEvent({
    action: "create",
    actor,
    source: auditSource,
    resource: {
      type: "email_campaign",
      id: campaignId,
      path: `${COLLECTIONS.emailCampaigns}/${campaignId}`,
      apiRoute: "/api/admin/email-list/campaigns",
    },
    summary: `Emailed "${subject}" to ${sentCount} of ${recipients.length} subscriber(s)`,
    after: campaign,
    context: AUDIT_CONTEXT,
  });

  return campaign;
}
