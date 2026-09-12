import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMailgunWebhookUrl,
  confirmWebhooksManually,
  describeMailgunSettings,
  formatMailgunAlias,
  maskSecret,
  mergeWebhookRegistrationResult,
  normalizeMailgunSettings,
  parseMailgunAlias,
  resolveMailgunConfig,
  resolveSendingDomain,
  validateMailgunSettings,
} from "./settings.js";

describe("mailgun/settings", () => {
  it("parses a bare address alias", () => {
    assert.deepEqual(parseMailgunAlias("Parish@MG.Example.org"), {
      displayName: "",
      address: "parish@mg.example.org",
      domain: "mg.example.org",
    });
  });

  it("parses a display-name alias", () => {
    assert.deepEqual(parseMailgunAlias("St Mary Parish <parish@mg.example.org>"), {
      displayName: "St Mary Parish",
      address: "parish@mg.example.org",
      domain: "mg.example.org",
    });
  });

  it("rejects invalid aliases", () => {
    assert.equal(parseMailgunAlias(""), null);
    assert.equal(parseMailgunAlias("not-an-email"), null);
    assert.equal(parseMailgunAlias("missing@domain"), null);
    assert.equal(parseMailgunAlias(42), null);
  });

  it("formats aliases back to a Mailgun From header", () => {
    assert.equal(formatMailgunAlias({ address: "a@b.org" }), "a@b.org");
    assert.equal(formatMailgunAlias({ displayName: "Parish", address: "a@b.org" }), "Parish <a@b.org>");
  });

  it("normalizes settings with defaults", () => {
    const settings = normalizeMailgunSettings(null);
    assert.equal(settings.enabled, true);
    assert.equal(settings.alias, "");
    assert.equal(settings.apiKey, "");
    assert.equal(settings.region, "us");
    assert.equal(settings.trackOpens, true);
    assert.equal(settings.trackClicks, true);
    assert.deepEqual(settings.webhook.events, []);
  });

  it("normalizes an alias and region", () => {
    const settings = normalizeMailgunSettings({
      alias: "  Parish Office <Office@MG.Example.org> ",
      apiKey: " key-123 ",
      region: "EU",
      sendingDomain: "MG.Example.org",
    });
    assert.equal(settings.alias, "Parish Office <office@mg.example.org>");
    assert.equal(settings.apiKey, "key-123");
    assert.equal(settings.region, "eu");
    assert.equal(settings.sendingDomain, "mg.example.org");
  });

  it("derives the sending domain from the alias unless overridden", () => {
    const fromAlias = normalizeMailgunSettings({ alias: "a@mg.example.org" });
    assert.equal(resolveSendingDomain(fromAlias), "mg.example.org");

    const overridden = normalizeMailgunSettings({
      alias: "a@example.org",
      sendingDomain: "mg.example.org",
    });
    assert.equal(resolveSendingDomain(overridden), "mg.example.org");
  });

  it("validates operator input", () => {
    const missingAlias = validateMailgunSettings(normalizeMailgunSettings({ apiKey: "k" }));
    assert.equal(missingAlias.ok, false);

    const missingKey = validateMailgunSettings(normalizeMailgunSettings({ alias: "a@mg.example.org" }));
    assert.equal(missingKey.ok, false);

    const badDomain = validateMailgunSettings(
      normalizeMailgunSettings({ alias: "a@mg.example.org", apiKey: "k", sendingDomain: "not a domain" }),
    );
    assert.equal(badDomain.ok, false);

    const ok = validateMailgunSettings(
      normalizeMailgunSettings({ alias: "a@mg.example.org", apiKey: "k" }),
    );
    assert.equal(ok.ok, true);
  });

  it("normalizes the forward-to address and route state", () => {
    const settings = normalizeMailgunSettings({
      alias: "a@mg.example.org",
      forwardTo: "  Office@Example.ORG ",
      inboundRoute: { id: " route-1 ", forwardTo: "Office@Example.ORG", expression: "x" },
    });
    assert.equal(settings.forwardTo, "office@example.org");
    assert.equal(settings.inboundRoute.id, "route-1");
    assert.equal(settings.inboundRoute.forwardTo, "office@example.org");

    const empty = normalizeMailgunSettings(null);
    assert.equal(empty.forwardTo, "");
    assert.deepEqual(empty.inboundRoute, {
      id: "",
      expression: "",
      forwardTo: "",
      updatedAt: "",
      lastError: "",
    });
  });

  it("validates the forward-to address", () => {
    const base = { alias: "a@mg.example.org", apiKey: "k" };

    assert.equal(validateMailgunSettings(normalizeMailgunSettings(base)).ok, true);
    assert.equal(
      validateMailgunSettings(normalizeMailgunSettings({ ...base, forwardTo: "office@example.org" })).ok,
      true,
    );

    const malformed = validateMailgunSettings(
      normalizeMailgunSettings({ ...base, forwardTo: "not-an-email" }),
    );
    assert.equal(malformed.ok, false);

    // Forwarding to the sending domain would bounce mail straight back at Mailgun.
    const loop = validateMailgunSettings(
      normalizeMailgunSettings({ ...base, forwardTo: "office@mg.example.org" }),
    );
    assert.equal(loop.ok, false);

    const loopViaOverride = validateMailgunSettings(
      normalizeMailgunSettings({
        alias: "a@example.org",
        apiKey: "k",
        sendingDomain: "mg.example.org",
        forwardTo: "office@mg.example.org",
      }),
    );
    assert.equal(loopViaOverride.ok, false);
  });

  it("reports forwarding state to the UI", () => {
    const off = describeMailgunSettings({ alias: "a@mg.example.org", apiKey: "k" }, {});
    assert.equal(off.forwardTo, "");
    assert.equal(off.inboundRoute.active, false);

    const on = describeMailgunSettings(
      {
        alias: "a@mg.example.org",
        apiKey: "k",
        forwardTo: "office@example.org",
        inboundRoute: {
          id: "route-1",
          expression: 'match_recipient(".*@mg\\.example\\.org")',
          forwardTo: "office@example.org",
        },
      },
      {},
    );
    assert.equal(on.forwardTo, "office@example.org");
    assert.equal(on.inboundRoute.active, true);
    assert.equal(on.inboundRoute.id, "route-1");
  });

  it("masks secrets", () => {
    assert.equal(maskSecret(""), "");
    assert.equal(maskSecret("abc"), "••••");
    assert.equal(maskSecret("key-1234567890abcd"), "••••abcd");
  });

  it("reports not configured when nothing is set", () => {
    const config = resolveMailgunConfig(null, {});
    assert.equal(config.configured, false);
    assert.equal(config.source, "none");
  });

  it("prefers saved settings over environment variables", () => {
    const config = resolveMailgunConfig(
      { alias: "Parish <parish@mg.example.org>", apiKey: "key-settings", region: "eu" },
      { MAILGUN_API_KEY: "key-env", MAILGUN_DOMAIN: "env.example.org", MAILGUN_FROM: "env@example.org" },
    );
    assert.equal(config.source, "settings");
    assert.equal(config.apiKey, "key-settings");
    assert.equal(config.domain, "mg.example.org");
    assert.equal(config.from, "Parish <parish@mg.example.org>");
    assert.equal(config.apiBaseUrl, "https://api.eu.mailgun.net");
  });

  it("falls back to environment variables", () => {
    const config = resolveMailgunConfig(null, {
      MAILGUN_API_KEY: "key-env",
      MAILGUN_DOMAIN: "MG.Example.org",
      MAILGUN_FROM: "noreply@mg.example.org",
    });
    assert.equal(config.configured, true);
    assert.equal(config.source, "env");
    assert.equal(config.domain, "mg.example.org");
    assert.equal(config.apiBaseUrl, "https://api.mailgun.net");
  });

  it("falls back to environment variables when the integration is disabled", () => {
    const config = resolveMailgunConfig(
      { alias: "a@mg.example.org", apiKey: "key-settings", enabled: false },
      { MAILGUN_API_KEY: "key-env", MAILGUN_DOMAIN: "env.org", MAILGUN_FROM: "e@env.org" },
    );
    assert.equal(config.source, "env");
  });

  it("stays unconfigured when only part of the env trio is present", () => {
    const config = resolveMailgunConfig(null, { MAILGUN_API_KEY: "key-env" });
    assert.equal(config.configured, false);
  });

  it("never exposes secrets in the UI description", () => {
    const description = describeMailgunSettings(
      {
        alias: "Parish <parish@mg.example.org>",
        apiKey: "key-1234567890abcd",
        webhookSigningKey: "signing-key",
        webhook: { secret: "s3cret", url: "https://p.org/api/mailgun/webhook/s3cret", events: ["delivered"] },
      },
      {},
    );

    assert.equal(description.configured, true);
    assert.equal(description.apiKeyPreview, "••••abcd");
    assert.equal(description.hasApiKey, true);
    assert.equal(description.hasWebhookSigningKey, true);
    assert.equal(description.webhook.registered, true);
    assert.equal(JSON.stringify(description).includes("key-1234567890abcd"), false);
    assert.equal(JSON.stringify(description).includes("signing-key"), false);
  });

  it("builds the webhook URL", () => {
    assert.equal(
      buildMailgunWebhookUrl("https://www.parish.org/", "abc123"),
      "https://www.parish.org/api/mailgun/webhook/abc123",
    );
  });

  it("preserves manual webhook confirmation when automatic registration fails", () => {
    const current = confirmWebhooksManually(
      { secret: "s3cret", url: "", events: [], registeredAt: "", lastError: "", manual: false },
      "https://parish.org/api/mailgun/webhook/s3cret",
    );
    const merged = mergeWebhookRegistrationResult(
      current,
      {
        registered: [],
        failed: [
          {
            id: "delivered",
            error:
              "Mailgun returned 401 updating the delivered: API key does not have sufficient permissions to perform this action",
          },
        ],
      },
      "https://parish.org/api/mailgun/webhook/s3cret",
    );

    assert.equal(merged.manual, true);
    assert.equal(merged.events.length, 8);
    assert.match(merged.lastError, /Primary Private API key/);
  });

  it("records manual webhook confirmation", () => {
    const confirmed = confirmWebhooksManually(
      { secret: "s3cret", url: "", events: [], registeredAt: "", lastError: "failed", manual: false },
      "https://parish.org/api/mailgun/webhook/s3cret",
    );

    assert.equal(confirmed.manual, true);
    assert.equal(confirmed.events.length, 8);
    assert.equal(confirmed.lastError, "");
    assert.equal(confirmed.url, "https://parish.org/api/mailgun/webhook/s3cret");
  });
});
