import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeUserRole } from "../auth/roles.js";
import { buildDonationPageSummary, isDonationPageData } from "./donation-pages.js";

describe("admin users role parsing", () => {
  it("accepts finance for invite and patch payloads", () => {
    assert.equal(normalizeUserRole("finance"), "finance");
  });

  it("rejects unknown invite roles by normalizing to member", () => {
    assert.equal(normalizeUserRole("superadmin"), "member");
  });
});

describe("finance/donation-pages helpers", () => {
  it("detects donation pages", () => {
    assert.equal(isDonationPageData({ pageType: "donation" }), true);
    assert.equal(isDonationPageData({ pageType: "content" }), false);
    assert.equal(isDonationPageData(null), false);
  });

  it("builds donation page summaries", () => {
    const summary = buildDonationPageSummary({
      id: "page-1",
      data: () => ({
        slug: "give",
        title: "Give",
        pageType: "donation",
        donationConfig: { title: "Support us" },
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    });

    assert.equal(summary.id, "page-1");
    assert.equal(summary.slug, "give");
    assert.equal(summary.title, "Give");
    assert.equal(summary.donationConfig.title, "Support us");
    assert.equal(summary.updatedAt, "2026-01-01T00:00:00.000Z");
  });
});
