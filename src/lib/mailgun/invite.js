import "server-only";

import { escapeHtml, sendMailgunEmail } from "./send.server.js";

/**
 * @param {{ to: string, resetLink: string, siteName?: string }} input
 * @returns {Promise<{ sent: boolean, messageId?: string, error?: string }>}
 */
export async function sendUserInviteEmail({ to, resetLink, siteName = "your church website" }) {
  const subject = `You've been invited to manage ${siteName}`;

  const text = [
    `You've been invited to manage ${siteName}.`,
    "",
    "Set your password using this link:",
    resetLink,
    "",
    "If you did not expect this invitation, you can ignore this email.",
  ].join("\n");

  const html = `<p>You've been invited to manage <strong>${escapeHtml(siteName)}</strong>.</p><p><a href="${escapeHtml(resetLink)}">Set your password</a> to get started.</p><p>If you did not expect this invitation, you can ignore this email.</p>`;

  return sendMailgunEmail({ to: [to], subject, text, html, kind: "user_invite" });
}
