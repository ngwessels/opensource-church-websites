import "server-only";

import { normalizeMessageKind } from "./events.js";
import { recordSentMessage } from "./messages.server.js";
import { getMailgunConfig } from "./settings.server.js";

/**
 * @typedef {import('./events.js').EmailMessageKind} EmailMessageKind
 * @typedef {import('./settings.js').MailgunConfig} MailgunConfig
 */

/** @param {string} str */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send one message through Mailgun and record it so webhook events have
 * something to attach to.
 *
 * Mailgun is optional: when it is not configured this resolves with
 * `{ sent: false }` and the caller carries on.
 *
 * @param {{
 *   to: string[],
 *   subject: string,
 *   text: string,
 *   html: string,
 *   kind: EmailMessageKind,
 *   replyTo?: string,
 *   context?: Record<string, string>,
 *   config?: MailgunConfig,
 * }} input
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
export async function sendMailgunEmail({ to, subject, text, html, kind, replyTo, context, config }) {
  const resolved = config ?? (await getMailgunConfig());

  if (!resolved.configured) {
    console.warn(`[mailgun] Not configured — skipping ${kind} email.`);
    return { sent: false, error: "Mailgun is not configured" };
  }

  const recipients = (to || []).map((address) => String(address).trim()).filter(Boolean);
  if (recipients.length === 0) {
    return { sent: false, error: "No notification recipients configured" };
  }

  const body = new URLSearchParams({
    from: resolved.from,
    to: recipients.join(","),
    subject,
    text,
    html,
    "o:tracking-opens": resolved.trackOpens ? "yes" : "no",
    "o:tracking-clicks": resolved.trackClicks ? "htmlonly" : "no",
    "o:tag": `church-website-${normalizeMessageKind(kind)}`,
    "v:kind": normalizeMessageKind(kind),
  });

  if (replyTo) body.set("h:Reply-To", replyTo);

  try {
    const res = await fetch(`${resolved.apiBaseUrl}/v3/${resolved.domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${resolved.apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[mailgun] ${kind} send failed:`, res.status, errText);
      return { sent: false, error: describeSendError(res.status, errText) };
    }

    const payload = await res.json().catch(() => ({}));
    const messageId = typeof payload.id === "string" ? payload.id : "";

    if (messageId) {
      await recordSentMessage({
        messageId,
        to: recipients,
        subject,
        kind: normalizeMessageKind(kind),
        from: resolved.from,
        domain: resolved.domain,
        context,
      });
    }

    return { sent: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mailgun request failed";
    console.error("[mailgun]", message);
    return { sent: false, error: message };
  }
}

/**
 * @param {number} status
 * @param {string} responseText
 * @returns {string}
 */
export function describeSendError(status, responseText) {
  switch (status) {
    case 401:
    case 403:
      return "Mailgun rejected the API key (401). Check the key in Admin → Email.";
    case 404:
      return "Mailgun does not recognise this sending domain (404). Check the alias domain.";
    case 400:
      return `Mailgun rejected the message (400): ${responseText.slice(0, 200)}`;
    case 429:
      return "Mailgun rate limit reached (429). Try again shortly.";
    default:
      return `Mailgun error: ${status}`;
  }
}
