import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, MAILGUN_INTEGRATION_ID } from "@/lib/firestore/paths";

import { normalizeMailgunSettings, resolveMailgunConfig } from "./settings.js";
import { generateWebhookSecret } from "./signature.js";

/**
 * @typedef {import('./settings.js').MailgunConfig} MailgunConfig
 * @typedef {import('./settings.js').MailgunSettings} MailgunSettings
 */

function settingsRef() {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  return db.collection(COLLECTIONS.integrations).doc(MAILGUN_INTEGRATION_ID);
}

/**
 * Read the stored integration. Returns normalized defaults (unconfigured) when
 * Firebase Admin or the document is missing, so callers never have to branch.
 *
 * @returns {Promise<MailgunSettings>}
 */
export async function getMailgunSettings() {
  const ref = settingsRef();
  if (!ref) return normalizeMailgunSettings(null);

  try {
    const snap = await ref.get();
    return normalizeMailgunSettings(snap.exists ? snap.data() : null);
  } catch (err) {
    console.warn("[mailgun] Could not read integration settings:", err instanceof Error ? err.message : err);
    return normalizeMailgunSettings(null);
  }
}

/**
 * Persist operator-supplied settings. The webhook secret is generated once and
 * reused so a re-save does not invalidate the URL registered with Mailgun.
 *
 * @param {Partial<MailgunSettings>} patch
 * @param {{ actorEmail?: string }} [options]
 * @returns {Promise<MailgunSettings>}
 */
export async function saveMailgunSettings(patch, options = {}) {
  const ref = settingsRef();
  if (!ref) throw new Error("Firebase Admin is not configured");

  const current = await getMailgunSettings();
  const next = normalizeMailgunSettings({
    ...current,
    ...patch,
    webhook: { ...current.webhook, ...(patch.webhook || {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: options.actorEmail ?? current.updatedBy,
  });

  if (!next.webhook.secret) {
    next.webhook = { ...next.webhook, secret: generateWebhookSecret() };
  }

  await ref.set(next, { merge: false });
  return next;
}

/**
 * Remove the stored integration. Sending falls back to `MAILGUN_*` environment
 * variables if those are set, otherwise email is simply disabled.
 *
 * @returns {Promise<void>}
 */
export async function deleteMailgunSettings() {
  const ref = settingsRef();
  if (!ref) throw new Error("Firebase Admin is not configured");
  await ref.delete();
}

/**
 * Resolve the config used for outbound sends: saved settings first, then the
 * legacy `MAILGUN_*` environment variables.
 *
 * @returns {Promise<MailgunConfig>}
 */
export async function getMailgunConfig() {
  const settings = await getMailgunSettings();
  return resolveMailgunConfig(settings, process.env);
}

/**
 * Cheap check for callers that only need to know whether email can be sent.
 *
 * @returns {Promise<boolean>}
 */
export async function isMailgunConfigured() {
  return (await getMailgunConfig()).configured;
}
