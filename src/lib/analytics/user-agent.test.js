import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isBotUserAgent, parseUserAgent } from "./user-agent.js";

describe("analytics/user-agent", () => {
  it("detects bots", () => {
    assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
    assert.equal(isBotUserAgent("Mozilla/5.0 Chrome/120.0"), false);
  });

  it("parses mobile chrome", () => {
    const parsed = parseUserAgent(
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    );
    assert.equal(parsed.deviceType, "mobile");
    assert.equal(parsed.browser, "Chrome");
    assert.equal(parsed.os, "Android");
  });

  it("parses desktop safari", () => {
    const parsed = parseUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15",
    );
    assert.equal(parsed.deviceType, "desktop");
    assert.equal(parsed.browser, "Safari");
    assert.equal(parsed.os, "macOS");
  });
});
