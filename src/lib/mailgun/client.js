import "server-only";

import { escapeHtml, sendMailgunEmail } from "./send.server.js";

/**
 * @param {{
 *   to: string[],
 *   formTitle: string,
 *   pageTitle?: string,
 *   rows: Array<{ label: string, value: string }>,
 *   formId?: string,
 * }} input
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
export async function sendFormNotification({ to, formTitle, pageTitle, rows, formId }) {
  const subject = pageTitle
    ? `New form submission: ${formTitle} (${pageTitle})`
    : `New form submission: ${formTitle}`;

  const text = [
    `A new submission was received for "${formTitle}".`,
    pageTitle ? `Page: ${pageTitle}` : "",
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
  ]
    .filter(Boolean)
    .join("\n");

  const htmlRows = rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;">${escapeHtml(r.label)}</td><td style="padding:4px 0;">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");

  const html = `<p>A new submission was received for <strong>${escapeHtml(formTitle)}</strong>.</p>${pageTitle ? `<p>Page: ${escapeHtml(pageTitle)}</p>` : ""}<table>${htmlRows}</table>`;

  return sendMailgunEmail({
    to,
    subject,
    text,
    html,
    kind: "form_notification",
    ...(formId || pageTitle ? { context: { ...(formId ? { formId } : {}), ...(pageTitle ? { pageTitle } : {}) } } : {}),
  });
}

/**
 * @param {{
 *   to: string[],
 *   groupName: string,
 *   intentions: Array<{ name: string, intention: string }>,
 *   siteName?: string,
 * }} input
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
export async function sendPrayerIntentionsDigestEmail({ to, groupName, intentions, siteName }) {
  if (!intentions.length) {
    return { sent: false, error: "No intentions to send" };
  }

  const parish = siteName || "Parish";
  const subject = `Weekly Prayer Intentions for ${groupName} — ${parish}`;

  const text = [
    `Dear ${groupName},`,
    "",
    `Please include the following prayer intentions in your prayers this week (${intentions.length}):`,
    "",
    ...intentions.map((item, i) => `${i + 1}. ${item.name}: ${item.intention}`),
    "",
    "Thank you for praying with our parish community.",
  ].join("\n");

  const listHtml = intentions
    .map(
      (item) =>
        `<li style="margin-bottom:12px;"><strong>${escapeHtml(item.name)}</strong><br/>${escapeHtml(item.intention)}</li>`,
    )
    .join("");

  const html = `
    <p>Dear ${escapeHtml(groupName)},</p>
    <p>Please include the following prayer intentions in your prayers this week (<strong>${intentions.length}</strong>):</p>
    <ol>${listHtml}</ol>
    <p>Thank you for praying with our parish community.</p>
  `;

  return sendMailgunEmail({
    to,
    subject,
    text,
    html,
    kind: "prayer_digest",
    context: { groupName },
  });
}

/**
 * @param {{ to: string, siteName?: string }} input
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
export async function sendMailgunTestEmail({ to, siteName = "your church website" }) {
  const subject = `Mailgun test from ${siteName}`;
  const text = [
    `This is a test email from ${siteName}.`,
    "",
    "If you received it, outbound email is working. Delivery and open events will",
    "appear under Admin → Email once Mailgun calls the webhook back.",
  ].join("\n");

  const html = `<p>This is a test email from <strong>${escapeHtml(siteName)}</strong>.</p><p>If you received it, outbound email is working. Delivery and open events will appear under <strong>Admin → Email</strong> once Mailgun calls the webhook back.</p>`;

  return sendMailgunEmail({ to: [to], subject, text, html, kind: "test" });
}
