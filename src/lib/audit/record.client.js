/**
 * @typedef {import('./schema.js').AuditAction} AuditAction
 * @typedef {import('./schema.js').AuditActor} AuditActor
 * @typedef {import('./schema.js').AuditResource} AuditResource
 * @typedef {import('./schema.js').AuditContext} AuditContext
 */

/**
 * Record an audit event via the server API (avoids client Firestore rules on auditEvents).
 *
 * @param {object} input
 * @param {AuditAction} input.action
 * @param {AuditActor} input.actor
 * @param {AuditResource} input.resource
 * @param {string} input.summary
 * @param {AuditContext} [input.context]
 * @param {unknown} [input.before]
 * @param {unknown} [input.after]
 * @param {() => Promise<string | undefined>} [input.getIdToken]
 * @returns {Promise<string | null>}
 */
export async function recordAuditEventViaApi(input) {
  try {
    let token;
    if (input.getIdToken) {
      token = await input.getIdToken();
    } else {
      const { getAuth } = await import("firebase/auth");
      token = await getAuth().currentUser?.getIdToken();
    }
    if (!token) {
      console.warn("[audit] skipped UI event without auth token", { summary: input.summary });
      return null;
    }

    const res = await fetch("/api/admin/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: input.action,
        resource: input.resource,
        summary: input.summary,
        context: input.context,
        before: input.before,
        after: input.after,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[audit] API record failed", data.error || res.statusText);
      return null;
    }

    const data = await res.json();
    return data.eventId ?? null;
  } catch (err) {
    console.warn("[audit] API record error", err);
    return null;
  }
}
