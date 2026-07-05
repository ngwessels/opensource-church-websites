import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getOAuthIssuer, oauthAbsoluteUrl } from "./origin.js";

describe("oauth config", () => {
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  });

  it("prefers NEXT_PUBLIC_APP_URL for the issuer", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.parish.org";
    process.env.NEXT_PUBLIC_SITE_URL = "https://ignored.example";
    assert.equal(getOAuthIssuer(), "https://www.parish.org");
  });

  it("rejects 0.0.0.0 and falls back to NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://0.0.0.0:3000";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.parish.org";
    assert.equal(getOAuthIssuer(), "https://www.parish.org");
  });

  it("builds login redirects from the configured issuer, not request.url", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.parish.org";
    const request = new Request("http://0.0.0.0:8080/oauth/authorize?client_id=test");
    assert.equal(oauthAbsoluteUrl("/oauth/login", request), "https://www.parish.org/oauth/login");
  });

  it("uses forwarded host when no public URL is configured", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const request = new Request("http://0.0.0.0:8080/oauth/authorize", {
      headers: {
        "x-forwarded-host": "www.parish.org",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(oauthAbsoluteUrl("/oauth/login", request), "https://www.parish.org/oauth/login");
  });
});
