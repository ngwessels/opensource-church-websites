/**
 * Turn an admin's rich-text body into the HTML and plain-text parts of an
 * email. Pure so the markup rules can be tested without Mailgun.
 *
 * The body comes from a trusted admin editor, but it is still reduced to a
 * small allowlist: mail clients drop most of what a browser accepts, and a
 * pasted fragment should never carry script or style into an inbox.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "hr",
  "img",
  "code",
  "pre",
  "span",
  "div",
]);

/**
 * Attributes kept per tag; everything else (including `on*`) is dropped.
 * `style` is allowed on every permitted tag because inline CSS is the only
 * styling mail clients reliably honour.
 */
const ALLOWED_ATTRIBUTES = {
  a: ["href", "title"],
  img: ["src", "alt", "title", "width", "height"],
};

const GLOBAL_ALLOWED_ATTRIBUTES = ["style"];

/** CSS that can execute or pull in remote rules. */
const UNSAFE_CSS_RE = /(expression\s*\(|javascript:|vbscript:|behavior\s*:|@import|<)/i;

const VOID_TAGS = new Set(["br", "hr", "img"]);

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * `%recipient.unsubscribe_url%` and other Mailgun variables must survive
 * escaping, so URLs are only rejected when they could execute.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isSafeUrl(url) {
  const value = url.trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith("javascript:") || value.startsWith("data:text/html")) return false;
  if (value.startsWith("vbscript:")) return false;
  return true;
}

/**
 * @param {string} tag
 * @param {string} attrString
 * @returns {string}
 */
function sanitizeAttributes(tag, attrString) {
  const allowed = [
    ...(ALLOWED_ATTRIBUTES[/** @type {keyof typeof ALLOWED_ATTRIBUTES} */ (tag)] ?? []),
    ...GLOBAL_ALLOWED_ATTRIBUTES,
  ];

  /** @type {string[]} */
  const kept = [];
  const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;

  while ((match = attrRe.exec(attrString)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;

    const value = match[3] ?? match[4] ?? "";
    if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
    if (name === "style" && UNSAFE_CSS_RE.test(value)) continue;

    kept.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }

  return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

/**
 * Reduce rich-text HTML to the allowlist above. Disallowed containers lose
 * their tags but keep their text; `script`, `style`, and friends lose both.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function sanitizeEmailHtml(input) {
  const html = typeof input === "string" ? input : "";
  if (!html.trim()) return "";

  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|svg|link|meta)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|svg|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag, attrs) => {
      const tag = String(rawTag).toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      const attributes = sanitizeAttributes(tag, String(attrs));
      return VOID_TAGS.has(tag) ? `<${tag}${attributes} />` : `<${tag}${attributes}>`;
    })
    .trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[/** @type {keyof typeof ENTITIES} */ (entity)] ?? entity);
}

/**
 * Plain-text alternative for clients that will not render HTML. Links keep
 * their target in parentheses so nothing is lost.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function htmlToPlainText(input) {
  const html = typeof input === "string" ? input : "";
  if (!html.trim()) return "";

  const withLinks = html.replace(
    /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
    (_, __, doubleQuoted, singleQuoted, label) => {
      const href = doubleQuoted ?? singleQuoted ?? "";
      const text = String(label).replace(/<[^>]*>/g, "").trim();
      if (!href) return text;
      return text && text !== href ? `${text} (${href})` : href;
    },
  );

  return decodeEntities(
    withLinks
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|li|blockquote|pre)>/gi, "\n")
      .replace(/<hr\s*\/?>/gi, "\n----------\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {string} html
 * @returns {boolean}
 */
export function hasVisibleContent(html) {
  if (typeof html !== "string") return false;
  if (/<img\b/i.test(html)) return true;
  return htmlToPlainText(html).length > 0;
}

/**
 * Wrap the body in the shell every list email shares: a heading with the
 * parish name, the message, and the unsubscribe footer bulk senders require.
 *
 * @param {{
 *   siteName: string,
 *   subject: string,
 *   bodyHtml: string,
 *   unsubscribeUrl: string,
 *   siteUrl?: string,
 *   footerNote?: string,
 * }} input
 * @returns {{ html: string, text: string }}
 */
export function renderCampaignEmail({
  siteName,
  subject,
  bodyHtml,
  unsubscribeUrl,
  siteUrl = "",
  footerNote = "",
}) {
  const safeBody = sanitizeEmailHtml(bodyHtml);
  const parishName = siteName || "Our Parish";
  const parish = escapeHtmlText(parishName);
  const note = footerNote ? `<p style="margin:0 0 8px;">${escapeHtmlText(footerNote)}</p>` : "";
  const siteLink = siteUrl
    ? `<p style="margin:0 0 8px;"><a href="${escapeHtmlText(siteUrl)}" style="color:#4b5563;">${escapeHtmlText(
        siteUrl.replace(/^https?:\/\//, ""),
      )}</a></p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtmlText(subject)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:8px;border:1px solid #e4e4e7;">
            <tr>
              <td style="padding:24px 28px 8px;font-family:Helvetica,Arial,sans-serif;">
                <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">${parish}</p>
                <h1 style="margin:6px 0 0;font-size:22px;line-height:1.3;color:#18181b;">${escapeHtmlText(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 24px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#27272a;">
                ${safeBody}
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
            <tr>
              <td style="padding:16px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#71717a;">
                ${note}${siteLink}
                <p style="margin:0;">You are receiving this because you joined the ${parish} email list. <a href="${unsubscribeUrl}" style="color:#71717a;">Unsubscribe</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    parishName.toUpperCase(),
    subject,
    "",
    htmlToPlainText(safeBody),
    "",
    footerNote,
    siteUrl,
    `Unsubscribe: ${unsubscribeUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { html, text };
}

/**
 * Body for a bulletin email: the admin's optional note, then a button and a
 * plain link to the bulletin PDF for clients that strip the button styling.
 *
 * @param {{ introHtml?: string, bulletinLabel: string, bulletinUrl: string, attached?: boolean }} input
 * @returns {string}
 */
export function buildBulletinBodyHtml({ introHtml = "", bulletinLabel, bulletinUrl, attached = false }) {
  const intro = sanitizeEmailHtml(introHtml);
  const label = escapeHtmlText(bulletinLabel);
  const url = escapeHtmlText(bulletinUrl);
  const attachedNote = attached
    ? `<p style="margin:0;font-size:14px;color:#52525b;">The bulletin is also attached to this email as a PDF.</p>`
    : "";

  return `${intro}
<p style="margin:20px 0 8px;"><a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Read the ${label} bulletin</a></p>
<p style="margin:0 0 12px;font-size:14px;color:#52525b;"><a href="${url}" style="color:#52525b;">${url}</a></p>
${attachedNote}`.trim();
}
