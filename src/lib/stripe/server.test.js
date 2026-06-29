import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getAppUrl, joinAppUrl } from "./server.js";

describe("stripe/server", () => {
  const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (prevSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl;
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  describe("getAppUrl", () => {
    it("strips trailing slashes from NEXT_PUBLIC_SITE_URL", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.org/";
      process.env.NEXT_PUBLIC_APP_URL = "https://ignored.example/";
      assert.equal(getAppUrl(), "https://example.org");
    });
  });

  describe("joinAppUrl", () => {
    it("joins origin and path without a double slash", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.org/";
      assert.equal(joinAppUrl("/giving"), "https://example.org/giving");
    });

    it("preserves query strings on the return path", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
      assert.equal(joinAppUrl("/giving?foo=bar"), "https://example.org/giving?foo=bar");
    });
  });
});
