import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  donorFromStripeSession,
  formatDonorAddress,
  getDonationConfig,
  normalizeDonationComments,
  normalizeDonationConfig,
  sanitizeDonorComment,
  sanitizeReturnPath,
  validateDonationConfig,
} from "./schema.js";

describe("donations/schema", () => {
  describe("normalizeDonationConfig", () => {
    it("returns default fund when config is empty", () => {
      const config = normalizeDonationConfig(null);
      assert.equal(config.funds.length, 1);
      assert.equal(config.funds[0].label, "General Fund");
    });

    it("filters funds without labels", () => {
      const config = normalizeDonationConfig({
        funds: [{ id: "a", label: "Building Fund" }, { id: "b", label: "   " }],
      });
      assert.equal(config.funds.length, 1);
      assert.equal(config.funds[0].label, "Building Fund");
    });

    it("includes default comments config", () => {
      const config = normalizeDonationConfig(null);
      assert.equal(config.comments.enabled, true);
      assert.equal(config.comments.label, "Comments");
      assert.equal(config.comments.placeholder, "");
    });

    it("merges custom comments config", () => {
      const config = normalizeDonationConfig({
        comments: {
          enabled: false,
          label: "Special intention",
          placeholder: "In memory of…",
        },
      });
      assert.equal(config.comments.enabled, false);
      assert.equal(config.comments.label, "Special intention");
      assert.equal(config.comments.placeholder, "In memory of…");
    });
  });

  describe("normalizeDonationComments", () => {
    it("defaults enabled to true", () => {
      const comments = normalizeDonationComments({});
      assert.equal(comments.enabled, true);
    });
  });

  describe("sanitizeDonorComment", () => {
    it("returns undefined for empty values", () => {
      assert.equal(sanitizeDonorComment(""), undefined);
      assert.equal(sanitizeDonorComment("   "), undefined);
      assert.equal(sanitizeDonorComment(null), undefined);
    });

    it("trims and preserves non-empty text", () => {
      assert.equal(sanitizeDonorComment("  Hello  "), "Hello");
    });

    it("truncates to 500 characters", () => {
      const long = "a".repeat(600);
      assert.equal(sanitizeDonorComment(long)?.length, 500);
    });
  });

  describe("getDonationConfig", () => {
    it("reads donationConfig from page", () => {
      const config = getDonationConfig({
        donationConfig: {
          funds: [{ id: "school", label: "School Fund", description: "Tuition aid" }],
        },
      });
      assert.equal(config.funds[0].label, "School Fund");
    });
  });

  describe("validateDonationConfig", () => {
    it("accepts valid funds", () => {
      const result = validateDonationConfig({
        funds: [{ id: "a", label: "General Fund" }, { id: "b", label: "Building Fund" }],
      });
      assert.equal(result.ok, true);
    });

    it("rejects duplicate fund labels", () => {
      const result = validateDonationConfig({
        funds: [
          { id: "a", label: "General Fund" },
          { id: "b", label: "general fund" },
        ],
      });
      assert.equal(result.ok, false);
      assert.match(result.error, /unique/i);
    });
  });

  describe("sanitizeReturnPath", () => {
    it("accepts valid relative paths", () => {
      assert.equal(sanitizeReturnPath("/give"), "/give");
      assert.equal(sanitizeReturnPath("/donate?foo=bar"), "/donate?foo=bar");
    });

    it("rejects protocol-relative and absolute URLs", () => {
      assert.equal(sanitizeReturnPath("//evil.com"), "/give");
      assert.equal(sanitizeReturnPath("https://evil.com"), "/give");
    });

    it("rejects paths not starting with slash", () => {
      assert.equal(sanitizeReturnPath("give"), "/give");
    });

    it("uses custom fallback", () => {
      assert.equal(sanitizeReturnPath(null, "/"), "/");
    });
  });

  describe("donorFromStripeSession", () => {
    it("maps Stripe customer_details to donor info", () => {
      const donor = donorFromStripeSession({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+15551234567",
        address: {
          line1: "123 Main St",
          line2: "Apt 4",
          city: "Portland",
          state: "OR",
          postal_code: "97201",
        },
      });
      assert.equal(donor?.name, "Jane Doe");
      assert.equal(donor?.email, "jane@example.com");
      assert.equal(donor?.phone, "+15551234567");
      assert.equal(donor?.address?.postalCode, "97201");
    });

    it("returns undefined when no identifying details exist", () => {
      assert.equal(donorFromStripeSession(null), undefined);
    });
  });

  describe("formatDonorAddress", () => {
    it("formats a full address", () => {
      const formatted = formatDonorAddress({
        name: "Jane",
        email: "jane@example.com",
        address: {
          line1: "123 Main St",
          line2: "Apt 4",
          city: "Portland",
          state: "OR",
          postalCode: "97201",
        },
      });
      assert.match(formatted, /123 Main St/);
      assert.match(formatted, /Portland/);
    });
  });
});
