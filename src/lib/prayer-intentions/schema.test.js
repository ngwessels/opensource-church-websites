import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizePrayerIntentionsConfig,
  normalizePrayerIntentionsSettings,
  parseModerationResponse,
  statusFromModerationDecision,
  validatePrayerIntentionSubmission,
  DEFAULT_PRAYER_GROUPS,
} from "./schema.js";

describe("normalizePrayerIntentionsConfig", () => {
  it("applies defaults and preserves ids", () => {
    const config = normalizePrayerIntentionsConfig({
      moduleInstanceId: "mod_1",
      honeypotFieldName: "_hp_test",
      notificationEmails: "a@b.com, not-an-email, c@d.org",
    });
    assert.equal(config.moduleInstanceId, "mod_1");
    assert.equal(config.honeypotFieldName, "_hp_test");
    assert.equal(config.title, "Prayer Intentions");
    assert.deepEqual(config.notificationEmails, ["a@b.com", "c@d.org"]);
  });
});

describe("normalizePrayerIntentionsSettings", () => {
  it("seeds default groups when empty", () => {
    const settings = normalizePrayerIntentionsSettings(null);
    assert.equal(settings.groups.length, DEFAULT_PRAYER_GROUPS.length);
    assert.equal(settings.groups[0].id, "clergy");
    assert.equal(settings.digestDayOfWeek, 1);
    assert.equal(settings.lastDigestAt, null);
  });

  it("keeps configured groups and emails", () => {
    const settings = normalizePrayerIntentionsSettings({
      groups: [{ id: "clergy", name: "Clergy", emails: ["pastor@parish.org"] }],
      lastDigestAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(settings.groups.length, 1);
    assert.deepEqual(settings.groups[0].emails, ["pastor@parish.org"]);
    assert.equal(settings.lastDigestAt, "2026-01-01T00:00:00.000Z");
  });
});

describe("validatePrayerIntentionSubmission", () => {
  it("requires name, intention, and contact", () => {
    const result = validatePrayerIntentionSubmission({
      name: "",
      email: "",
      phone: "",
      intention: "",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.name);
      assert.ok(result.errors.intention);
      assert.ok(result.errors.contact);
    }
  });

  it("accepts phone-only contact", () => {
    const result = validatePrayerIntentionSubmission({
      name: "Jane",
      email: "",
      phone: "555-0100",
      intention: "For healing",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.values.name, "Jane");
      assert.equal(result.values.phone, "555-0100");
    }
  });
});

describe("moderation parsing", () => {
  it("parses JSON decisions", () => {
    const decision = parseModerationResponse({
      isPrayerIntention: true,
      isSpam: false,
      hasNegativeImpact: false,
      reason: "Genuine prayer request",
    });
    assert.equal(statusFromModerationDecision(decision), "approved");
  });

  it("rejects spam and harmful content", () => {
    assert.equal(
      statusFromModerationDecision({
        isPrayerIntention: true,
        isSpam: true,
        hasNegativeImpact: false,
      }),
      "rejected",
    );
    assert.equal(
      statusFromModerationDecision({
        isPrayerIntention: true,
        isSpam: false,
        hasNegativeImpact: true,
      }),
      "rejected",
    );
    assert.equal(
      statusFromModerationDecision({
        isPrayerIntention: false,
        isSpam: false,
        hasNegativeImpact: false,
      }),
      "rejected",
    );
  });

  it("parses fenced JSON strings", () => {
    const decision = parseModerationResponse(`\`\`\`json
{"isPrayerIntention":true,"isSpam":false,"hasNegativeImpact":false,"reason":"OK"}
\`\`\``);
    assert.equal(decision.isPrayerIntention, true);
    assert.equal(decision.reason, "OK");
  });
});
