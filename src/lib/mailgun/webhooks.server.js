import "server-only";

import { MAILGUN_WEBHOOK_IDS } from "./events.js";

/**
 * @typedef {import('./settings.js').MailgunConfig} MailgunConfig
 */

/**
 * @param {MailgunConfig} config
 * @returns {HeadersInit}
 */
function authHeaders(config) {
  return {
    Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
  };
}

/**
 * Confirm the API key can see the sending domain before we save it.
 *
 * @param {MailgunConfig} config
 * @returns {Promise<{ ok: true, state: string } | { ok: false, error: string }>}
 */
export async function verifyMailgunDomain(config) {
  try {
    const res = await fetch(`${config.apiBaseUrl}/v3/domains/${config.domain}`, {
      headers: authHeaders(config),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Mailgun rejected the API key. Check that you copied the private API key." };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error: `Mailgun has no domain named ${config.domain}. Add the domain in Mailgun, or set a sending domain override.`,
      };
    }
    if (!res.ok) {
      return { ok: false, error: `Mailgun returned ${res.status} while checking the domain.` };
    }

    const payload = await res.json().catch(() => ({}));
    const state = typeof payload?.domain?.state === "string" ? payload.domain.state : "unknown";
    return { ok: true, state };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach Mailgun.";
    return { ok: false, error: message };
  }
}

/**
 * Point every delivery-status webhook at this site. Mailgun stores one URL per
 * event id, so re-registering is idempotent.
 *
 * @param {MailgunConfig} config
 * @param {string} webhookUrl
 * @returns {Promise<{ registered: string[], failed: Array<{ id: string, error: string }> }>}
 */
export async function registerMailgunWebhooks(config, webhookUrl) {
  /** @type {string[]} */
  const registered = [];
  /** @type {Array<{ id: string, error: string }>} */
  const failed = [];

  for (const id of MAILGUN_WEBHOOK_IDS) {
    try {
      await upsertWebhook(config, id, webhookUrl);
      registered.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : "Registration failed" });
    }
  }

  return { registered, failed };
}

/**
 * @param {MailgunConfig} config
 * @param {string} id
 * @param {string} webhookUrl
 * @returns {Promise<void>}
 */
async function upsertWebhook(config, id, webhookUrl) {
  const base = `${config.apiBaseUrl}/v3/domains/${config.domain}/webhooks`;

  const update = await fetch(`${base}/${id}`, {
    method: "PUT",
    headers: { ...authHeaders(config), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url: webhookUrl }).toString(),
  });

  if (update.ok) return;

  if (update.status !== 404) {
    throw new Error(`Mailgun returned ${update.status} updating the ${id} webhook.`);
  }

  const create = await fetch(base, {
    method: "POST",
    headers: { ...authHeaders(config), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id, url: webhookUrl }).toString(),
  });

  if (!create.ok) {
    throw new Error(`Mailgun returned ${create.status} creating the ${id} webhook.`);
  }
}

/**
 * Remove the webhooks we registered — used when the integration is disconnected.
 *
 * @param {MailgunConfig} config
 * @returns {Promise<{ removed: string[] }>}
 */
export async function deleteMailgunWebhooks(config) {
  /** @type {string[]} */
  const removed = [];

  for (const id of MAILGUN_WEBHOOK_IDS) {
    try {
      const res = await fetch(`${config.apiBaseUrl}/v3/domains/${config.domain}/webhooks/${id}`, {
        method: "DELETE",
        headers: authHeaders(config),
      });
      if (res.ok) removed.push(id);
    } catch (err) {
      console.warn("[mailgun] Could not delete webhook", id, err instanceof Error ? err.message : err);
    }
  }

  return { removed };
}
