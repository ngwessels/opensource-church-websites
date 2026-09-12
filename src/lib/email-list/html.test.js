import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBulletinBodyHtml,
  hasVisibleContent,
  htmlToPlainText,
  renderCampaignEmail,
  sanitizeEmailHtml,
} from "./html.js";

test("sanitizeEmailHtml keeps allowed formatting", () => {
  const html = sanitizeEmailHtml("<p>Hello <strong>parish</strong></p><ul><li>One</li></ul>");
  assert.equal(html, "<p>Hello <strong>parish</strong></p><ul><li>One</li></ul>");
});

test("sanitizeEmailHtml removes scripts, styles, and event handlers", () => {
  const html = sanitizeEmailHtml(
    '<p onclick="steal()">Hi</p><script>alert(1)</script><style>p{color:red}</style>',
  );
  assert.equal(html, "<p>Hi</p>");
});

test("sanitizeEmailHtml unwraps unknown tags but keeps their text", () => {
  assert.equal(sanitizeEmailHtml("<article><p>Kept</p></article>"), "<p>Kept</p>");
});

test("sanitizeEmailHtml keeps image sources and link targets", () => {
  const html = sanitizeEmailHtml(
    '<p><a href="https://parish.org" target="_blank" rel="x">Site</a></p><img src="https://parish.org/p.jpg" alt="Parish" width="600">',
  );
  assert.equal(
    html,
    '<p><a href="https://parish.org">Site</a></p><img src="https://parish.org/p.jpg" alt="Parish" width="600" />',
  );
});

test("sanitizeEmailHtml drops javascript: URLs", () => {
  assert.equal(sanitizeEmailHtml('<a href="javascript:alert(1)">Bad</a>'), "<a>Bad</a>");
});

test("sanitizeEmailHtml keeps inline styles but not executable CSS", () => {
  assert.equal(
    sanitizeEmailHtml('<p style="margin:0 0 8px;">Styled</p>'),
    '<p style="margin:0 0 8px;">Styled</p>',
  );
  assert.equal(
    sanitizeEmailHtml('<p style="width:expression(alert(1))">Bad</p>'),
    "<p>Bad</p>",
  );
});

test("htmlToPlainText keeps link targets and list markers", () => {
  const text = htmlToPlainText(
    '<p>Hello</p><ul><li>First</li><li><a href="https://parish.org/give">Give</a></li></ul>',
  );
  assert.equal(text, "Hello\n- First\n- Give (https://parish.org/give)");
});

test("htmlToPlainText decodes entities", () => {
  assert.equal(htmlToPlainText("<p>Tea &amp; coffee&nbsp;after Mass</p>"), "Tea & coffee after Mass");
});

test("hasVisibleContent treats an image-only body as content", () => {
  assert.equal(hasVisibleContent("<p><br></p>"), false);
  assert.equal(hasVisibleContent('<p><img src="https://x/y.png" /></p>'), true);
  assert.equal(hasVisibleContent("<p>Hi</p>"), true);
});

test("renderCampaignEmail wraps the body and appends an unsubscribe link", () => {
  const { html, text } = renderCampaignEmail({
    siteName: "St Mary",
    subject: "This week",
    bodyHtml: "<p>Join us <strong>Sunday</strong></p>",
    unsubscribeUrl: "https://parish.org/api/email-list/unsubscribe?token=abc",
    siteUrl: "https://parish.org",
  });

  assert.match(html, /Join us <strong>Sunday<\/strong>/);
  assert.match(html, /unsubscribe\?token=abc/);
  assert.match(html, /St Mary/);
  assert.match(text, /Unsubscribe: https:\/\/parish\.org\/api\/email-list\/unsubscribe\?token=abc/);
  assert.match(text, /Join us Sunday/);
});

test("renderCampaignEmail escapes the subject it echoes into markup", () => {
  const { html } = renderCampaignEmail({
    siteName: "St Mary",
    subject: '<script>bad</script>',
    bodyHtml: "<p>Hi</p>",
    unsubscribeUrl: "https://parish.org/u",
  });
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
});

test("renderCampaignEmail leaves Mailgun recipient variables intact", () => {
  const { html, text } = renderCampaignEmail({
    siteName: "St Mary",
    subject: "This week",
    bodyHtml: "<p>Hi</p>",
    unsubscribeUrl: "%recipient.unsubscribe_url%",
  });
  assert.match(html, /%recipient\.unsubscribe_url%/);
  assert.match(text, /%recipient\.unsubscribe_url%/);
});

test("buildBulletinBodyHtml includes the intro, a button, and the raw link", () => {
  const body = buildBulletinBodyHtml({
    introHtml: "<p>Here is this week's bulletin.</p>",
    bulletinLabel: "October 12, 2025",
    bulletinUrl: "https://files.parish.org/bulletin.pdf",
    attached: true,
  });

  assert.match(body, /Here is this week's bulletin\./);
  assert.match(body, /Read the October 12, 2025 bulletin/);
  assert.match(body, /https:\/\/files\.parish\.org\/bulletin\.pdf/);
  assert.match(body, /also attached/);
});

test("the bulletin button keeps its styling through the email shell", () => {
  const { html } = renderCampaignEmail({
    siteName: "St Mary & All Saints",
    subject: "Bulletin",
    bodyHtml: buildBulletinBodyHtml({
      bulletinLabel: "October 12, 2025",
      bulletinUrl: "https://files.parish.org/bulletin.pdf",
    }),
    unsubscribeUrl: "https://parish.org/u",
  });

  assert.match(html, /background:#18181b;color:#ffffff/);
});

test("renderCampaignEmail leaves the parish name unescaped in the text part", () => {
  const { text } = renderCampaignEmail({
    siteName: "St Mary & All Saints",
    subject: "Hello",
    bodyHtml: "<p>Hi</p>",
    unsubscribeUrl: "https://parish.org/u",
  });

  assert.match(text, /ST MARY & ALL SAINTS/);
});
