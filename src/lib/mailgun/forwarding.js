/**
 * Inbound email forwarding — pure helpers for the optional "forward replies to"
 * mailbox. Forwarding is implemented with a Mailgun *route*: Mailgun matches
 * every message addressed to the sending domain and forwards it on, so replies
 * to site email and brand-new inbound mail both land in one mailbox.
 *
 * Mailgun routes live on the account, not on a domain, so the filter has to
 * scope itself to our sending domain and the route has to be recognisable when
 * we come back to update or remove it.
 */

/**
 * @typedef {import('./settings.js').MailgunRouteState} MailgunRouteState
 */

/** @typedef {'none' | 'create' | 'update' | 'delete'} MailgunForwardingAction */

/**
 * @typedef {object} MailgunForwardingPlan
 * @property {MailgunForwardingAction} action
 * @property {string} routeId Existing route to update or delete, empty when creating.
 * @property {string} expression Filter to register, empty when deleting.
 * @property {string} forwardTo Destination to register, empty when deleting.
 */

/**
 * Lower numbers win in Mailgun. Leave room above us so an operator's own routes
 * keep running first if they add any by hand.
 */
export const MAILGUN_FORWARD_ROUTE_PRIORITY = 10;

/** Marker written into the route description so we can find our own route. */
export const MAILGUN_FORWARD_ROUTE_TAG = "church-website-forward";

/**
 * @param {string} domain
 * @returns {string}
 */
export function mailgunForwardRouteDescription(domain) {
  return `${MAILGUN_FORWARD_ROUTE_TAG}:${domain}`;
}

/**
 * @param {unknown} description
 * @returns {boolean}
 */
export function isMailgunForwardRouteDescription(description) {
  return typeof description === "string" && description.startsWith(`${MAILGUN_FORWARD_ROUTE_TAG}:`);
}

/**
 * Catch every recipient on the sending domain: the alias itself (so replies
 * arrive), plus any other address someone emails on that domain.
 *
 * @param {string} domain
 * @returns {string}
 */
export function buildMailgunForwardExpression(domain) {
  const escaped = String(domain || "").trim().toLowerCase().replace(/[.\\]/g, "\\$&");
  return escaped ? `match_recipient(".*@${escaped}")` : "";
}

/**
 * Decide what has to happen at Mailgun for the settings an operator just saved.
 *
 * @param {{
 *   domain: string,
 *   forwardTo: string,
 *   route?: MailgunRouteState | null,
 *   force?: boolean,
 * }} input
 * @returns {MailgunForwardingPlan}
 */
export function planMailgunForwarding({ domain, forwardTo, route, force = false }) {
  const routeId = typeof route?.id === "string" ? route.id.trim() : "";
  const destination = String(forwardTo || "").trim().toLowerCase();
  const expression = buildMailgunForwardExpression(domain);

  if (!destination || !expression) {
    return routeId
      ? { action: "delete", routeId, expression: "", forwardTo: "" }
      : { action: "none", routeId: "", expression: "", forwardTo: "" };
  }

  if (!routeId) {
    return { action: "create", routeId: "", expression, forwardTo: destination };
  }

  const unchanged = route?.forwardTo === destination && route?.expression === expression;
  return unchanged && !force
    ? { action: "none", routeId, expression, forwardTo: destination }
    : { action: "update", routeId, expression, forwardTo: destination };
}

/**
 * One-line summary for the admin UI notice after a save.
 *
 * @param {MailgunForwardingPlan} plan
 * @returns {string}
 */
export function describeMailgunForwardingAction(plan) {
  switch (plan.action) {
    case "create":
      return `Inbound email is now forwarded to ${plan.forwardTo}.`;
    case "update":
      return `Inbound email forwarding updated to ${plan.forwardTo}.`;
    case "delete":
      return "Inbound email forwarding removed.";
    case "none":
      return "";
    default: {
      /** @type {never} */
      const exhaustive = plan.action;
      return exhaustive;
    }
  }
}
