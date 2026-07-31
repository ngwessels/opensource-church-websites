import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizePrayerIntentionsConfig,
  normalizePrayerIntentionsSettings,
  parseModerationResponse,
  resolveAssignedGroupIds,
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
  it("requires name, email, and intention", () => {
    const result = validatePrayerIntentionSubmission({
      name: "",
      email: "",
      phone: "",
      intention: "",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.name);
      assert.ok(result.errors.email);
      assert.ok(result.errors.intention);
    }
  });

  it("accepts email with optional phone", () => {
    const result = validatePrayerIntentionSubmission({
      name: "Jane",
      email: "jane@example.com",
      phone: "",
      intention: "For healing",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.values.name, "Jane");
      assert.equal(result.values.email, "jane@example.com");
    }
  });

  it("rejects phone-only without email", () => {
    const result = validatePrayerIntentionSubmission({
      name: "Jane",
      email: "",
      phone: "555-0100",
      intention: "For healing",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.email);
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

  it("parses fenced JSON strings and groupIds", () => {
    const decision = parseModerationResponse(
      `\`\`\`json
{"isPrayerIntention":true,"isSpam":false,"hasNegativeImpact":false,"reason":"OK","groupIds":["clergy","youth-group","unknown"]}
\`\`\``,
      ["clergy", "youth-group", "staff"],
    );
    assert.equal(decision.isPrayerIntention, true);
    assert.equal(decision.reason, "OK");
    assert.deepEqual(decision.groupIds, ["clergy", "youth-group"]);
  });

  it("falls back to all groups when approved with none selected", () => {
    assert.deepEqual(
      resolveAssignedGroupIds([], ["clergy", "staff"], "approved"),
      ["clergy", "staff"],
    );
    assert.deepEqual(resolveAssignedGroupIds(["youth-group"], ["clergy", "youth-group"], "approved"), [
      "youth-group",
    ]);
    assert.deepEqual(resolveAssignedGroupIds(["clergy"], ["clergy"], "rejected"), []);
  });

  it("includes descriptions on default groups", () => {
    const settings = normalizePrayerIntentionsSettings(null);
    assert.ok(settings.groups[0].description.length > 0);
  });
});
