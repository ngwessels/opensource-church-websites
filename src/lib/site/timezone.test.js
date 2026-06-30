import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_SITE_TIMEZONE,
  formatTimezoneLabel,
  normalizeSiteTimezone,
} from "./timezone.js";

describe("site/timezone", () => {
  it("defaults missing or invalid values to Los Angeles", () => {
    assert.equal(normalizeSiteTimezone(undefined), DEFAULT_SITE_TIMEZONE);
    assert.equal(normalizeSiteTimezone(""), DEFAULT_SITE_TIMEZONE);
    assert.equal(normalizeSiteTimezone("   "), DEFAULT_SITE_TIMEZONE);
    assert.equal(normalizeSiteTimezone("Not/A/Timezone"), DEFAULT_SITE_TIMEZONE);
  });

  it("accepts valid IANA timezones", () => {
    assert.equal(normalizeSiteTimezone("America/New_York"), "America/New_York");
    assert.equal(normalizeSiteTimezone("  America/Chicago  "), "America/Chicago");
  });

  it("formats known timezone labels", () => {
    assert.equal(formatTimezoneLabel("America/Los_Angeles"), "Pacific — Los Angeles");
    assert.equal(formatTimezoneLabel("America/New_York"), "Eastern — New York");
  });

  it("falls back to IANA id for unknown-but-valid zones", () => {
    assert.equal(formatTimezoneLabel("America/Detroit"), "America/Detroit");
  });
});
