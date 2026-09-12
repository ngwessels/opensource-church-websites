/**
 * Mailgun integration settings — pure helpers shared by the server, the admin
 * API, and the builder UI. Mailgun is optional: every consumer must keep
 * working when nothing here is configured.
 */

/** @typedef {'us' | 'eu'} MailgunRegion */

/**
 * @typedef {object} MailgunWebhookState
 * @property {string} secret Random path segment that authenticates inbound Mailgun calls.
 * @property {string} url Webhook URL registered with Mailgun.
 * @property {string[]} events Mailgun webhook ids that were registered.
 * @property {string} registeredAt
 * @property {string} lastError
 */

/**
 * @typedef {object} MailgunSettings
 * @property {boolean} enabled
 * @property {string} alias Sending alias, e.g. `St Mary Parish <parish@mg.stmary.org>`.
 * @property {string} apiKey Mailgun private API key. Never sent to the browser.
 * @property {MailgunRegion} region
 * @property {string} sendingDomain Overrides the domain taken from the alias.
 * @property {string} webhookSigningKey Optional Mailgun HTTP webhook signing key.
 * @property {boolean} trackOpens
 * @property {boolean} trackClicks
 * @property {MailgunWebhookState} webhook
 * @property {string} updatedAt
 * @property {string} updatedBy
 */

/**
 * @typedef {object} MailgunConfig
 * @property {boolean} configured
 * @property {'settings' | 'env' | 'none'} source
 * @property {string} apiKey
 * @property {string} domain
 * @property {string} from
 * @property {MailgunRegion} region
 * @property {string} apiBaseUrl
 * @property {boolean} trackOpens
 * @property {boolean} trackClicks
 * @property {string} webhookSigningKey
 * @property {string} webhookSecret
 */

export const MAILGUN_REGIONS = /** @type {const} */ (["us", "eu"]);

export const MAILGUN_API_BASE_URLS = {
  us: "https://api.mailgun.net",
  eu: "https://api.eu.mailgun.net",
};

export const MAILGUN_REGION_LABELS = {
  us: "US (api.mailgun.net)",
  eu: "EU (api.eu.mailgun.net)",
};

const ALIAS_WITH_NAME_RE = /^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {unknown} value
 * @returns {string}
 */
function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parse `Name <user@domain>` or a bare `user@domain` alias.
 *
 * @param {unknown} raw
 * @returns {{ displayName: string, address: string, domain: string } | null}
 */
export function parseMailgunAlias(raw) {
  const value = str(raw);
  if (!value) return null;

  const withName = value.match(ALIAS_WITH_NAME_RE);
  const displayName = withName ? withName[1].replace(/^"|"$/g, "").trim() : "";
  const address = (withName ? withName[2] : value).toLowerCase();

  if (!EMAIL_RE.test(address)) return null;

  const domain = address.slice(address.indexOf("@") + 1);
  if (!domain) return null;

  return { displayName, address, domain };
}

/**
 * @param {{ displayName?: string, address: string }} alias
 * @returns {string}
 */
export function formatMailgunAlias({ displayName, address }) {
  const name = str(displayName);
  return name ? `${name} <${address}>` : address;
}

/**
 * @param {unknown} value
 * @returns {MailgunRegion}
 */
function normalizeRegion(value) {
  const region = str(value).toLowerCase();
  return region === "eu" ? "eu" : "us";
}

/**
 * @param {unknown} raw
 * @returns {MailgunWebhookState}
 */
function normalizeWebhookState(raw) {
  const w = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    secret: str(w.secret),
    url: str(w.url),
    events: Array.isArray(w.events) ? w.events.filter((e) => typeof e === "string") : [],
    registeredAt: str(w.registeredAt),
    lastError: str(w.lastError),
  };
}

/**
 * @param {unknown} raw
 * @returns {MailgunSettings}
 */
export function normalizeMailgunSettings(raw) {
  const s = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const alias = parseMailgunAlias(s.alias);

  return {
    enabled: s.enabled !== false,
    alias: alias ? formatMailgunAlias(alias) : "",
    apiKey: str(s.apiKey),
    region: normalizeRegion(s.region),
    sendingDomain: str(s.sendingDomain).toLowerCase(),
    webhookSigningKey: str(s.webhookSigningKey),
    trackOpens: s.trackOpens !== false,
    trackClicks: s.trackClicks !== false,
    webhook: normalizeWebhookState(s.webhook),
    updatedAt: str(s.updatedAt),
    updatedBy: str(s.updatedBy),
  };
}

/**
 * Validate settings an operator submitted from the admin UI.
 *
 * @param {MailgunSettings} settings
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateMailgunSettings(settings) {
  if (!settings.alias) {
    return { ok: false, error: "Enter a sending alias, e.g. Parish Office <parish@mg.yourparish.org>." };
  }
  if (!settings.apiKey) {
    return { ok: false, error: "Enter your Mailgun API key." };
  }
  if (settings.sendingDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(settings.sendingDomain)) {
    return { ok: false, error: "Sending domain must be a domain name, e.g. mg.yourparish.org." };
  }
  return { ok: true };
}

/**
 * @param {MailgunSettings} settings
 * @returns {string}
 */
export function resolveSendingDomain(settings) {
  if (settings.sendingDomain) return settings.sendingDomain;
  return parseMailgunAlias(settings.alias)?.domain || "";
}

/**
 * @param {MailgunRegion} region
 * @returns {string}
 */
export function mailgunApiBaseUrl(region) {
  return MAILGUN_API_BASE_URLS[region] || MAILGUN_API_BASE_URLS.us;
}

/**
 * Show enough of a secret to recognise it without exposing it.
 *
 * @param {string} value
 * @returns {string}
 */
export function maskSecret(value) {
  const secret = str(value);
  if (!secret) return "";
  if (secret.length <= 4) return "••••";
  return `••••${secret.slice(-4)}`;
}

/**
 * Resolve the config used to talk to Mailgun. Settings saved in the app win;
 * `MAILGUN_*` environment variables remain supported for existing deployments.
 *
 * @param {MailgunSettings | null | undefined} settings
 * @param {Record<string, string | undefined>} [env]
 * @returns {MailgunConfig}
 */
export function resolveMailgunConfig(settings, env = {}) {
  const normalized = normalizeMailgunSettings(settings);
  const domain = resolveSendingDomain(normalized);
  const alias = parseMailgunAlias(normalized.alias);

  if (normalized.enabled && normalized.apiKey && domain && alias) {
    return {
      configured: true,
      source: "settings",
      apiKey: normalized.apiKey,
      domain,
      from: normalized.alias,
      region: normalized.region,
      apiBaseUrl: mailgunApiBaseUrl(normalized.region),
      trackOpens: normalized.trackOpens,
      trackClicks: normalized.trackClicks,
      webhookSigningKey: normalized.webhookSigningKey,
      webhookSecret: normalized.webhook.secret,
    };
  }

  const envApiKey = str(env.MAILGUN_API_KEY);
  const envDomain = str(env.MAILGUN_DOMAIN).toLowerCase();
  const envFrom = str(env.MAILGUN_FROM);

  if (envApiKey && envDomain && envFrom) {
    return {
      configured: true,
      source: "env",
      apiKey: envApiKey,
      domain: envDomain,
      from: envFrom,
      region: normalizeRegion(env.MAILGUN_REGION),
      apiBaseUrl: mailgunApiBaseUrl(normalizeRegion(env.MAILGUN_REGION)),
      trackOpens: true,
      trackClicks: true,
      webhookSigningKey: str(env.MAILGUN_WEBHOOK_SIGNING_KEY),
      webhookSecret: "",
    };
  }

  return {
    configured: false,
    source: "none",
    apiKey: "",
    domain: "",
    from: "",
    region: "us",
    apiBaseUrl: mailgunApiBaseUrl("us"),
    trackOpens: false,
    trackClicks: false,
    webhookSigningKey: "",
    webhookSecret: "",
  };
}

/**
 * Browser-safe view of the integration. Secrets are masked, never returned.
 *
 * @param {MailgunSettings | null | undefined} settings
 * @param {Record<string, string | undefined>} [env]
 * @returns {{
 *   configured: boolean,
 *   source: 'settings' | 'env' | 'none',
 *   enabled: boolean,
 *   alias: string,
 *   domain: string,
 *   region: MailgunRegion,
 *   sendingDomain: string,
 *   apiKeyPreview: string,
 *   hasApiKey: boolean,
 *   hasWebhookSigningKey: boolean,
 *   trackOpens: boolean,
 *   trackClicks: boolean,
 *   webhook: { registered: boolean, url: string, events: string[], registeredAt: string, lastError: string },
 *   updatedAt: string,
 *   updatedBy: string,
 * }}
 */
export function describeMailgunSettings(settings, env = {}) {
  const normalized = normalizeMailgunSettings(settings);
  const config = resolveMailgunConfig(normalized, env);

  return {
    configured: config.configured,
    source: config.source,
    enabled: normalized.enabled,
    alias: config.source === "env" ? config.from : normalized.alias,
    domain: config.domain,
    region: config.region,
    sendingDomain: normalized.sendingDomain,
    apiKeyPreview: maskSecret(normalized.apiKey),
    hasApiKey: Boolean(normalized.apiKey),
    hasWebhookSigningKey: Boolean(normalized.webhookSigningKey),
    trackOpens: normalized.trackOpens,
    trackClicks: normalized.trackClicks,
    webhook: {
      registered: Boolean(normalized.webhook.url && normalized.webhook.events.length > 0),
      url: normalized.webhook.url,
      events: normalized.webhook.events,
      registeredAt: normalized.webhook.registeredAt,
      lastError: normalized.webhook.lastError,
    },
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy,
  };
}

/**
 * @param {string} baseUrl Public site origin, e.g. `https://www.yourparish.org`.
 * @param {string} secret
 * @returns {string}
 */
export function buildMailgunWebhookUrl(baseUrl, secret) {
  const origin = str(baseUrl).replace(/\/+$/, "");
  return `${origin}/api/mailgun/webhook/${secret}`;
}
