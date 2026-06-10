import "server-only";

import { isMailgunConfigured } from "@/lib/mailgun/client";

/**
 * @param {{ to: string, resetLink: string, siteName?: string }}
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
export async function sendUserInviteEmail({ to, resetLink, siteName = "your church website" }) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM;

  if (!isMailgunConfigured()) {
    return { sent: false, error: "Mailgun is not configured" };
  }

  const subject = `You've been invited to manage ${siteName}`;
  const textBody = [
    `You've been invited to manage ${siteName}.`,
    "",
    "Set your password using this link:",
    resetLink,
    "",
    "If you did not expect this invitation, you can ignore this email.",
  ].join("\n");

  const htmlBody = `<p>You've been invited to manage <strong>${escapeHtml(siteName)}</strong>.</p><p><a href="${escapeHtml(resetLink)}">Set your password</a> to get started.</p><p>If you did not expect this invitation, you can ignore this email.</p>`;

  const body = new URLSearchParams({
    from: from,
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });

  try {
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[mailgun:invite] send failed:", res.status, errText);
      return { sent: false, error: `Mailgun error: ${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mailgun request failed";
    console.error("[mailgun:invite]", message);
    return { sent: false, error: message };
  }
}

/** @param {string} str */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
