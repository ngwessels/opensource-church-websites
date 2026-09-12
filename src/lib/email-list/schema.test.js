import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildUnsubscribeUrl,
  campaignStatusFromCounts,
  chunkRecipients,
  isValidEmail,
  normalizeCampaign,
  normalizeSubscriber,
  parseSubscriberInput,
  subscriberDocId,
  summarizeSubscribers,
  validateCampaignInput,
} from "./schema.js";

test("isValidEmail accepts addresses and rejects junk", () => {
  assert.equal(isValidEmail("Parish@Example.ORG"), true);
  assert.equal(isValidEmail("no-at-sign"), false);
  assert.equal(isValidEmail("two@@example.org"), false);
  assert.equal(isValidEmail("missing@domain"), false);
});

test("subscriberDocId lowercases and keeps the address readable", () => {
  assert.equal(subscriberDocId("  Anne@Parish.org "), "anne@parish.org");
});

test("parseSubscriberInput handles lines, separators, and named addresses", () => {
  const { entries, invalid } = parseSubscriberInput(
    `Anne Smith <anne@parish.org>\nbob@parish.org, carol@parish.org; dave@parish.org\nnot-an-email`,
  );

  assert.deepEqual(
    entries.map((e) => e.email),
    ["anne@parish.org", "bob@parish.org", "carol@parish.org", "dave@parish.org"],
  );
  assert.equal(entries[0].name, "Anne Smith");
  assert.deepEqual(invalid, ["not-an-email"]);
});

test("parseSubscriberInput dedupes and keeps the first name it saw", () => {
  const { entries } = parseSubscriberInput("Anne <anne@parish.org>\nanne@parish.org");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "Anne");
});

test("normalizeSubscriber fills defaults for legacy documents", () => {
  const subscriber = normalizeSubscriber({ email: "ANNE@parish.org", status: "nonsense" });
  assert.equal(subscriber.email, "anne@parish.org");
  assert.equal(subscriber.status, "subscribed");
  assert.equal(subscriber.source, "admin");
  assert.equal(subscriber.name, "");
});

test("summarizeSubscribers counts each status", () => {
  const summary = summarizeSubscribers(
    [
      { status: "subscribed" },
      { status: "subscribed" },
      { status: "unsubscribed" },
      { status: "bounced" },
    ].map(normalizeSubscriber),
  );
  assert.deepEqual(summary, { total: 4, subscribed: 2, unsubscribed: 1, bounced: 1 });
});

test("validateCampaignInput requires a subject and a body", () => {
  assert.deepEqual(validateCampaignInput({ subject: "", html: "<p>Hi</p>" }).ok, false);
  assert.deepEqual(validateCampaignInput({ subject: "Hello", html: "<p> </p>" }).ok, false);
  assert.deepEqual(validateCampaignInput({ subject: "Hello", html: "<p>Hi</p>" }), { ok: true });
});

test("validateCampaignInput accepts an image-only body", () => {
  assert.deepEqual(
    validateCampaignInput({ subject: "Photos", html: '<p><img src="https://x/y.png" /></p>' }),
    { ok: true },
  );
});

test("validateCampaignInput rejects oversized attachments", () => {
  const result = validateCampaignInput({
    subject: "Bulletin",
    html: "<p>Hi</p>",
    attachments: [{ name: "big.pdf", url: "https://x/big.pdf", sizeBytes: 20 * 1024 * 1024 }],
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /under 10\.0 MB/);
});

test("chunkRecipients splits into batches Mailgun will accept", () => {
  const recipients = Array.from({ length: 5 }, (_, i) => `p${i}@parish.org`);
  assert.deepEqual(chunkRecipients(recipients, 2), [
    ["p0@parish.org", "p1@parish.org"],
    ["p2@parish.org", "p3@parish.org"],
    ["p4@parish.org"],
  ]);
  assert.deepEqual(chunkRecipients([], 2), []);
});

test("campaignStatusFromCounts distinguishes partial sends", () => {
  assert.equal(campaignStatusFromCounts({ sentCount: 10, failedCount: 0 }), "sent");
  assert.equal(campaignStatusFromCounts({ sentCount: 10, failedCount: 2 }), "partial");
  assert.equal(campaignStatusFromCounts({ sentCount: 0, failedCount: 3 }), "failed");
});

test("normalizeCampaign drops attachments without a URL", () => {
  const campaign = normalizeCampaign({
    subject: " Bulletin ",
    kind: "bulletin",
    status: "sent",
    attachments: [{ name: "a.pdf", url: "https://x/a.pdf", sizeBytes: 10 }, { name: "b.pdf" }],
  });
  assert.equal(campaign.subject, "Bulletin");
  assert.equal(campaign.kind, "bulletin");
  assert.equal(campaign.attachments.length, 1);
});

test("buildUnsubscribeUrl encodes the token onto the site origin", () => {
  assert.equal(
    buildUnsubscribeUrl("https://parish.org/", "ab/cd"),
    "https://parish.org/api/email-list/unsubscribe?token=ab%2Fcd",
  );
});
