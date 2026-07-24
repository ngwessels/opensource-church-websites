import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  browserFromClientHints,
  isBotUserAgent,
  parseUserAgent,
} from "./user-agent.js";
import { getCountryFromHeaders } from "./schema.js";

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

  it("parses chrome when UA also mentions chromium", () => {
    const parsed = parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Chromium/120.0.0.0",
    );
    assert.equal(parsed.browser, "Chrome");
  });

  it("parses iOS chrome (CriOS)", () => {
    const parsed = parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
    );
    assert.equal(parsed.deviceType, "mobile");
    assert.equal(parsed.browser, "Chrome");
    assert.equal(parsed.os, "iOS");
  });

  it("parses empty UA as unknown desktop", () => {
    const parsed = parseUserAgent("");
    assert.equal(parsed.deviceType, "desktop");
    assert.equal(parsed.browser, "Unknown");
  });

  it("falls back to Sec-CH-UA when classic UA is empty", () => {
    const parsed = parseUserAgent("", {
      secChUa: `"Chromium";v="120", "Google Chrome";v="120", "Not.A/Brand";v="99"`,
    });
    assert.equal(parsed.browser, "Chrome");
  });

  it("reads browser brands from client hints", () => {
    assert.equal(
      browserFromClientHints(`"Not.A/Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"`),
      "Edge",
    );
  });
});

describe("analytics/country headers", () => {
  it("reads vercel and cloudfront country headers", () => {
    assert.equal(
      getCountryFromHeaders(new Headers({ "x-vercel-ip-country": "us" })),
      "US",
    );
    assert.equal(
      getCountryFromHeaders(new Headers({ "cloudfront-viewer-country": "CA" })),
      "CA",
    );
    assert.equal(
      getCountryFromHeaders(new Headers({ "x-appengine-country": "??" })),
      undefined,
    );
  });
});
