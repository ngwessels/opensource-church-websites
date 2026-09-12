import "server-only";

import { normalizeMessageKind } from "./events.js";
import { recordSentMessage } from "./messages.server.js";
import { describeSendError } from "./send.server.js";
import { getMailgunConfig } from "./settings.server.js";

/**
 * @typedef {import('./events.js').EmailMessageKind} EmailMessageKind
 * @typedef {import('./settings.js').MailgunConfig} MailgunConfig
 */

/**
 * @typedef {object} BulkRecipient
 * @property {string} email
 * @property {Record<string, string>} [variables] Per-recipient Mailgun variables, e.g. `unsubscribe_url`.
 */

/**
 * @typedef {object} BulkAttachment
 * @property {string} filename
 * @property {string} contentType
 * @property {Uint8Array} data
 */

/**
 * @typedef {object} BulkBatchResult
 * @property {string} messageId
 * @property {number} recipientCount
 * @property {string} error
 */

/**
 * Send one batch to Mailgun as a single message with per-recipient variables,
 * so every address on the list gets its own `To:` header and unsubscribe link.
 *
 * Unlike `sendMailgunEmail`, this posts multipart/form-data because Mailgun
 * only accepts file attachments that way.
 *
 * @param {{
 *   recipients: BulkRecipient[],
 *   subject: string,
 *   text: string,
 *   html: string,
 *   kind: EmailMessageKind,
 *   attachments?: BulkAttachment[],
 *   replyTo?: string,
 *   listUnsubscribeUrl?: string,
 *   context?: Record<string, string>,
 *   config?: MailgunConfig,
 * }} input
 * @returns {Promise<BulkBatchResult>}
 */
export async function sendMailgunBatch({
  recipients,
  subject,
  text,
  html,
  kind,
  attachments = [],
  replyTo,
  listUnsubscribeUrl,
  context,
  config,
}) {
  const resolved = config ?? (await getMailgunConfig());

  if (!resolved.configured) {
    return { messageId: "", recipientCount: 0, error: "Mailgun is not configured" };
  }

  const addresses = recipients.map((r) => String(r.email || "").trim()).filter(Boolean);
  if (addresses.length === 0) {
    return { messageId: "", recipientCount: 0, error: "No recipients" };
  }

  /** @type {Record<string, Record<string, string>>} */
  const recipientVariables = {};
  for (const recipient of recipients) {
    const email = String(recipient.email || "").trim();
    if (!email) continue;
    recipientVariables[email] = recipient.variables ?? {};
  }

  const form = new FormData();
  form.set("from", resolved.from);
  for (const address of addresses) {
    form.append("to", address);
  }
  form.set("subject", subject);
  form.set("text", text);
  form.set("html", html);
  form.set("recipient-variables", JSON.stringify(recipientVariables));
  form.set("o:tracking-opens", resolved.trackOpens ? "yes" : "no");
  form.set("o:tracking-clicks", resolved.trackClicks ? "htmlonly" : "no");
  form.set("o:tag", `church-website-${normalizeMessageKind(kind)}`);
  form.set("v:kind", normalizeMessageKind(kind));

  if (replyTo) form.set("h:Reply-To", replyTo);
  if (listUnsubscribeUrl) {
    form.set("h:List-Unsubscribe", `<${listUnsubscribeUrl}>`);
    form.set("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  }

  for (const attachment of attachments) {
    form.append(
      "attachment",
      new Blob([attachment.data], { type: attachment.contentType || "application/octet-stream" }),
      attachment.filename,
    );
  }

  try {
    const res = await fetch(`${resolved.apiBaseUrl}/v3/${resolved.domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${resolved.apiKey}`).toString("base64")}`,
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[mailgun] ${kind} batch send failed:`, res.status, errText);
      return {
        messageId: "",
        recipientCount: addresses.length,
        error: describeSendError(res.status, errText),
      };
    }

    const payload = await res.json().catch(() => ({}));
    const messageId = typeof payload.id === "string" ? payload.id : "";

    if (messageId) {
      await recordSentMessage({
        messageId,
        to: addresses,
        subject,
        kind: normalizeMessageKind(kind),
        from: resolved.from,
        domain: resolved.domain,
        context,
      });
    }

    return { messageId, recipientCount: addresses.length, error: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mailgun request failed";
    console.error("[mailgun]", message);
    return { messageId: "", recipientCount: addresses.length, error: message };
  }
}

/**
 * Download a file the admin attached from the media library so its bytes can
 * be posted to Mailgun.
 *
 * @param {{ url: string, name: string, mimeType?: string }} file
 * @param {{ maxBytes: number }} limits
 * @returns {Promise<BulkAttachment>}
 */
export async function fetchAttachment(file, { maxBytes }) {
  const res = await fetch(file.url);
  if (!res.ok) {
    throw new Error(`Could not download attachment "${file.name}" (${res.status}).`);
  }

  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Attachment "${file.name}" is too large to email.`);
  }

  return {
    filename: file.name,
    contentType: file.mimeType || res.headers.get("content-type") || "application/octet-stream",
    data: buffer,
  };
}
