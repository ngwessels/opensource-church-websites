import "server-only";

/**
 * @param {{ to: string[], formTitle: string, pageTitle?: string, rows: Array<{ label: string, value: string }> }}
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
export async function sendFormNotification({ to, formTitle, pageTitle, rows }) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM;

  if (!apiKey || !domain || !from) {
    console.warn("[mailgun] Not configured — skipping form notification email.");
    return { sent: false, error: "Mailgun is not configured" };
  }

  if (!to.length) {
    return { sent: false, error: "No notification recipients configured" };
  }

  const subject = pageTitle ? `New form submission: ${formTitle} (${pageTitle})` : `New form submission: ${formTitle}`;

  const textBody = [
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

  const htmlBody = `<p>A new submission was received for <strong>${escapeHtml(formTitle)}</strong>.</p>${pageTitle ? `<p>Page: ${escapeHtml(pageTitle)}</p>` : ""}<table>${htmlRows}</table>`;

  const body = new URLSearchParams({
    from,
    to: to.join(","),
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
      console.error("[mailgun] send failed:", res.status, errText);
      return { sent: false, error: `Mailgun error: ${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mailgun request failed";
    console.error("[mailgun]", message);
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

export function isMailgunConfigured() {
  return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN && process.env.MAILGUN_FROM);
}
