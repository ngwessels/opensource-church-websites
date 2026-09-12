import "server-only";

import {
  MAILGUN_FORWARD_ROUTE_PRIORITY,
  isMailgunForwardRouteDescription,
  mailgunForwardRouteDescription,
  planMailgunForwarding,
} from "./forwarding.js";

/**
 * @typedef {import('./settings.js').MailgunConfig} MailgunConfig
 * @typedef {import('./settings.js').MailgunRouteState} MailgunRouteState
 * @typedef {import('./forwarding.js').MailgunForwardingPlan} MailgunForwardingPlan
 */

/** Mailgun caps the page size; a parish account never has this many routes. */
const ROUTE_PAGE_LIMIT = 1000;

/**
 * @param {MailgunConfig} config
 * @returns {Record<string, string>}
 */
function authHeaders(config) {
  return {
    Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
  };
}

/**
 * @param {MailgunForwardingPlan} plan
 * @returns {URLSearchParams}
 */
function routeBody(plan) {
  const body = new URLSearchParams();
  body.set("priority", String(MAILGUN_FORWARD_ROUTE_PRIORITY));
  body.set("expression", plan.expression);
  // `action` repeats for each action; we only forward, so other routes an
  // operator added by hand keep working.
  body.append("action", `forward("${plan.forwardTo}")`);
  return body;
}

/**
 * Find a route we previously created, so a lost route id does not leave a
 * duplicate behind.
 *
 * @param {MailgunConfig} config
 * @returns {Promise<string>} Route id, or empty when there is none.
 */
async function findOwnRouteId(config) {
  const res = await fetch(`${config.apiBaseUrl}/v3/routes?limit=${ROUTE_PAGE_LIMIT}`, {
    headers: authHeaders(config),
  });
  if (!res.ok) throw new Error(describeRouteError(res.status, "listing routes"));

  const payload = await res.json().catch(() => ({}));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const own = items.find(
    (item) =>
      isMailgunForwardRouteDescription(item?.description) &&
      item.description === mailgunForwardRouteDescription(config.domain),
  );

  return typeof own?.id === "string" ? own.id : "";
}

/**
 * @param {MailgunConfig} config
 * @param {MailgunForwardingPlan} plan
 * @returns {Promise<string>} The created route id.
 */
async function createRoute(config, plan) {
  const body = routeBody(plan);
  body.set("description", mailgunForwardRouteDescription(config.domain));

  const res = await fetch(`${config.apiBaseUrl}/v3/routes`, {
    method: "POST",
    headers: { ...authHeaders(config), "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(describeRouteError(res.status, "creating the forwarding route"));

  const payload = await res.json().catch(() => ({}));
  const id = typeof payload?.route?.id === "string" ? payload.route.id : "";
  if (!id) throw new Error("Mailgun created the forwarding route but returned no route id.");
  return id;
}

/**
 * @param {MailgunConfig} config
 * @param {MailgunForwardingPlan} plan
 * @returns {Promise<string>} The route id that now holds the forward.
 */
async function updateRoute(config, plan) {
  const body = routeBody(plan);
  body.set("description", mailgunForwardRouteDescription(config.domain));

  const res = await fetch(`${config.apiBaseUrl}/v3/routes/${encodeURIComponent(plan.routeId)}`, {
    method: "PUT",
    headers: { ...authHeaders(config), "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  // Someone deleted the route in the Mailgun control panel; make a new one.
  if (res.status === 404) return createRoute(config, plan);

  if (!res.ok) throw new Error(describeRouteError(res.status, "updating the forwarding route"));
  return plan.routeId;
}

/**
 * Remove a forwarding route. A route that is already gone counts as removed.
 *
 * @param {MailgunConfig} config
 * @param {string} routeId
 * @returns {Promise<void>}
 */
export async function deleteMailgunForwardingRoute(config, routeId) {
  if (!routeId) return;

  const res = await fetch(`${config.apiBaseUrl}/v3/routes/${encodeURIComponent(routeId)}`, {
    method: "DELETE",
    headers: authHeaders(config),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(describeRouteError(res.status, "removing the forwarding route"));
  }
}

/**
 * Make Mailgun match the saved `forwardTo` address: create, update, or remove
 * the route as needed.
 *
 * Mailgun problems are reported, never thrown — the rest of the integration
 * must still save, exactly like webhook registration.
 *
 * @param {MailgunConfig} config
 * @param {{ forwardTo: string, route?: MailgunRouteState | null, force?: boolean }} input
 * @returns {Promise<{ plan: MailgunForwardingPlan, route: MailgunRouteState, error: string }>}
 */
export async function syncMailgunForwardingRoute(config, { forwardTo, route, force = false }) {
  const plan = planMailgunForwarding({
    domain: config.domain,
    forwardTo,
    route,
    force,
  });

  /** @type {MailgunRouteState} */
  const current = {
    id: route?.id || "",
    expression: route?.expression || "",
    forwardTo: route?.forwardTo || "",
    updatedAt: route?.updatedAt || "",
    lastError: route?.lastError || "",
  };

  try {
    switch (plan.action) {
      case "none":
        return { plan, route: { ...current, lastError: "" }, error: "" };

      case "delete": {
        await deleteMailgunForwardingRoute(config, plan.routeId);
        return {
          plan,
          route: { id: "", expression: "", forwardTo: "", updatedAt: new Date().toISOString(), lastError: "" },
          error: "",
        };
      }

      case "create": {
        const existingId = await findOwnRouteId(config);
        const id = existingId
          ? await updateRoute(config, { ...plan, routeId: existingId })
          : await createRoute(config, plan);
        return { plan, route: registeredState(id, plan), error: "" };
      }

      case "update": {
        const id = await updateRoute(config, plan);
        return { plan, route: registeredState(id, plan), error: "" };
      }

      default: {
        /** @type {never} */
        const exhaustive = plan.action;
        throw new Error(`Unhandled forwarding action: ${String(exhaustive)}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mailgun forwarding request failed.";
    console.warn("[mailgun/forwarding]", message);
    return { plan, route: { ...current, lastError: message }, error: message };
  }
}

/**
 * @param {string} id
 * @param {MailgunForwardingPlan} plan
 * @returns {MailgunRouteState}
 */
function registeredState(id, plan) {
  return {
    id,
    expression: plan.expression,
    forwardTo: plan.forwardTo,
    updatedAt: new Date().toISOString(),
    lastError: "",
  };
}

/**
 * @param {number} status
 * @param {string} what
 * @returns {string}
 */
export function describeRouteError(status, what) {
  switch (status) {
    case 401:
    case 403:
      return `Mailgun rejected the API key while ${what}. Forwarding needs a key with route permissions.`;
    case 404:
      return `Mailgun could not find the route while ${what}.`;
    case 400:
      return `Mailgun rejected the forwarding route (400) while ${what}.`;
    case 429:
      return `Mailgun rate limit reached (429) while ${what}. Try again shortly.`;
    default:
      return `Mailgun returned ${status} while ${what}.`;
  }
}
