import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEventToMessageStatus,
  applyEventToRecipientStatuses,
  buildInitialRecipientStatuses,
  emailEventRank,
  expandEmailMessagesForAdmin,
  isWebhookPermissionError,
  messageDocId,
  normalizeMailgunWebhookEvent,
  normalizeMessageId,
  normalizeMessageKind,
  headlineDeliveryCounts,
  summarizeDeliveryStats,
  summarizeWebhookRegistrationFailures,
} from "./events.js";

/**
 * @param {string} event
 * @param {object} [overrides]
 */
function webhookBody(event, overrides = {}) {
  return {
    signature: { timestamp: "1529006854", token: "token", signature: "sig" },
    "event-data": {
      id: `evt-${event}`,
      event,
      timestamp: 1529006854.329574,
      recipient: "Person@Example.org",
      message: { headers: { "message-id": "20180614.1@mg.example.org" } },
      ...overrides,
    },
  };
}

describe("mailgun/events", () => {
  it("normalizes message ids from both Mailgun shapes", () => {
    assert.equal(normalizeMessageId("<ABC@mg.example.org>"), "abc@mg.example.org");
    assert.equal(normalizeMessageId("abc@mg.example.org"), "abc@mg.example.org");
    assert.equal(normalizeMessageId(undefined), "");
    assert.equal(messageDocId("<a/b@mg.example.org>"), "a_b@mg.example.org");
  });

  it("normalizes a delivered webhook", () => {
    const result = normalizeMailgunWebhookEvent(webhookBody("delivered"));
    assert.equal(result.ok, true);
    assert.equal(result.event.type, "delivered");
    assert.equal(result.event.messageId, "20180614.1@mg.example.org");
    assert.equal(result.event.recipient, "person@example.org");
    assert.equal(result.event.timestamp, new Date(1529006854.329574 * 1000).toISOString());
  });

  it("maps legacy and webhook-id event names", () => {
    assert.equal(normalizeMailgunWebhookEvent(webhookBody("unsubscribe")).event.type, "unsubscribed");
    assert.equal(normalizeMailgunWebhookEvent(webhookBody("permanent_fail")).event.type, "failed");
    assert.equal(normalizeMailgunWebhookEvent(webhookBody("temporary_fail")).event.type, "failed");
    assert.equal(normalizeMailgunWebhookEvent(webhookBody("complaint")).event.type, "complained");
  });

  it("reads failure details", () => {
    const result = normalizeMailgunWebhookEvent(
      webhookBody("failed", {
        severity: "permanent",
        reason: "suppress-bounce",
        "delivery-status": { code: 605, description: "Not delivering to previously bounced address" },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.event.severity, "permanent");
    assert.equal(result.event.code, 605);
    assert.equal(result.event.description, "Not delivering to previously bounced address");
  });

  it("reads the clicked URL", () => {
    const result = normalizeMailgunWebhookEvent(webhookBody("clicked", { url: "https://parish.org/give" }));
    assert.equal(result.event.url, "https://parish.org/give");
  });

  it("accepts a flat legacy payload", () => {
    const result = normalizeMailgunWebhookEvent({
      event: "opened",
      timestamp: 1529006854,
      recipient: "person@example.org",
      "Message-Id": "<20180614.1@mg.example.org>",
    });
    assert.equal(result.ok, true);
    assert.equal(result.event.type, "opened");
    assert.equal(result.event.messageId, "20180614.1@mg.example.org");
  });

  it("rejects payloads it cannot use", () => {
    assert.equal(normalizeMailgunWebhookEvent(null).ok, false);
    assert.equal(normalizeMailgunWebhookEvent(webhookBody("nonsense")).ok, false);
    assert.equal(
      normalizeMailgunWebhookEvent({ "event-data": { event: "delivered", timestamp: 1 } }).ok,
      false,
    );
  });

  it("ranks statuses so failures outrank deliveries", () => {
    assert.ok(emailEventRank("failed") > emailEventRank("clicked"));
    assert.ok(emailEventRank("clicked") > emailEventRank("opened"));
    assert.ok(emailEventRank("opened") > emailEventRank("delivered"));
    assert.ok(emailEventRank("delivered") > emailEventRank("accepted"));
  });

  it("advances message status as events arrive", () => {
    const delivered = applyEventToMessageStatus(
      {},
      normalizeMailgunWebhookEvent(webhookBody("delivered")).event,
    );
    assert.equal(delivered.status, "delivered");
    assert.ok(delivered.deliveredAt);

    const opened = applyEventToMessageStatus(
      delivered,
      normalizeMailgunWebhookEvent(webhookBody("opened")).event,
    );
    assert.equal(opened.status, "opened");
    assert.equal(opened.openCount, 1);
  });

  it("keeps the highest status when events arrive out of order", () => {
    const opened = applyEventToMessageStatus(
      {},
      normalizeMailgunWebhookEvent(webhookBody("opened")).event,
    );
    const thenDelivered = applyEventToMessageStatus(
      { ...opened },
      normalizeMailgunWebhookEvent(webhookBody("delivered")).event,
    );
    assert.equal(thenDelivered.status, "opened");
    assert.ok(thenDelivered.deliveredAt, "still records the delivery timestamp");
  });

  it("counts repeat opens and clicks but keeps the first timestamp", () => {
    const first = applyEventToMessageStatus(
      {},
      normalizeMailgunWebhookEvent(webhookBody("opened")).event,
    );
    const second = applyEventToMessageStatus(
      { ...first },
      normalizeMailgunWebhookEvent(webhookBody("opened", { timestamp: 1529099999 })).event,
    );
    assert.equal(second.openCount, 2);
    assert.equal(second.openedAt, first.openedAt);
  });

  it("records failure reasons and lets failures win", () => {
    const delivered = applyEventToMessageStatus(
      {},
      normalizeMailgunWebhookEvent(webhookBody("delivered")).event,
    );
    const failed = applyEventToMessageStatus(
      { ...delivered },
      normalizeMailgunWebhookEvent(
        webhookBody("failed", { "delivery-status": { description: "Mailbox full" } }),
      ).event,
    );
    assert.equal(failed.status, "failed");
    assert.equal(failed.failureReason, "Mailbox full");
  });

  it("normalizes message kinds", () => {
    assert.equal(normalizeMessageKind("form_notification"), "form_notification");
    assert.equal(normalizeMessageKind("unknown-kind"), "other");
    assert.equal(normalizeMessageKind(undefined), "other");
  });
});

describe("mailgun recipient tracking", () => {
  it("tracks delivery status separately per recipient", () => {
    let statuses = buildInitialRecipientStatuses(["a@example.org", "b@example.org"]);
    statuses = applyEventToRecipientStatuses(
      statuses,
      normalizeMailgunWebhookEvent(webhookBody("opened", { recipient: "a@example.org" })).event,
    );
    statuses = applyEventToRecipientStatuses(
      statuses,
      normalizeMailgunWebhookEvent(webhookBody("delivered", { recipient: "b@example.org" })).event,
    );

    assert.equal(statuses["a@example.org"].status, "opened");
    assert.equal(statuses["b@example.org"].status, "delivered");
  });

  it("expands bulk sends into one admin row per recipient", () => {
    const rows = expandEmailMessagesForAdmin([
      {
        id: "msg-1",
        messageId: "msg-1",
        to: ["a@example.org", "b@example.org"],
        subject: "Hello",
        kind: "bulletin_campaign",
        status: "opened",
        recipientStatuses: {
          "a@example.org": { status: "opened", statusRank: 30, lastEventAt: "2026-09-12T00:00:00.000Z" },
          "b@example.org": { status: "delivered", statusRank: 20, lastEventAt: "2026-09-12T00:00:00.000Z" },
        },
      },
    ]);

    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].to, ["a@example.org"]);
    assert.equal(rows[0].status, "opened");
    assert.deepEqual(rows[1].to, ["b@example.org"]);
    assert.equal(rows[1].status, "delivered");
  });
});

describe("mailgun delivery summaries", () => {
  it("counts recipients by delivery status", () => {
    const summary = summarizeDeliveryStats([
      { status: "opened" },
      { status: "delivered" },
      { status: "failed" },
    ]);

    assert.equal(summary.total, 3);
    assert.equal(summary.opened, 1);
    assert.equal(summary.delivered, 1);
    assert.equal(summary.failed, 1);
  });

  it("rolls exclusive buckets into overlapping headline counts", () => {
    const counts = headlineDeliveryCounts(
      summarizeDeliveryStats([
        { status: "opened" },
        { status: "clicked" },
        { status: "delivered" },
        { status: "queued" },
        { status: "failed" },
      ]),
    );

    assert.equal(counts.delivered, 3);
    assert.equal(counts.opened, 2);
    assert.equal(counts.clicked, 1);
    assert.equal(counts.failed, 1);
    assert.equal(counts.pending, 1);
  });

  it("keeps zeros visible when nothing has happened yet", () => {
    const counts = headlineDeliveryCounts(summarizeDeliveryStats([{ status: "queued" }]));
    assert.equal(counts.delivered, 0);
    assert.equal(counts.opened, 0);
    assert.equal(counts.clicked, 0);
    assert.equal(counts.failed, 0);
    assert.equal(counts.pending, 1);
  });
});

describe("mailgun webhook registration helpers", () => {
  it("detects Mailgun webhook permission errors", () => {
    assert.equal(
      isWebhookPermissionError(
        "Mailgun returned 401 updating the delivered: API key does not have sufficient permissions to perform this action",
      ),
      true,
    );
    assert.equal(isWebhookPermissionError("Mailgun returned 404 creating the delivered."), false);
  });

  it("collapses repeated permission failures into one hint", () => {
    const summary = summarizeWebhookRegistrationFailures([
      {
        id: "delivered",
        error:
          "Mailgun returned 401 updating the delivered: API key does not have sufficient permissions to perform this action",
      },
    ]);
    assert.match(summary, /Primary Private API key/);
    assert.doesNotMatch(summary, /accepted:/);
  });
});
