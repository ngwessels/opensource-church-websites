import "server-only";

import { randomBytes } from "node:crypto";

import { recordAuditEvent } from "@/lib/audit/record.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

import {
  isValidEmail,
  normalizeEmail,
  normalizeSubscriber,
  normalizeSubscriberSource,
  normalizeSubscriberStatus,
  subscriberDocId,
  summarizeSubscribers,
} from "./schema.js";

/**
 * @typedef {import('./schema.js').EmailSubscriber} EmailSubscriber
 * @typedef {import('./schema.js').EmailSubscriberSource} EmailSubscriberSource
 * @typedef {import('./schema.js').EmailSubscriberStatus} EmailSubscriberStatus
 * @typedef {import('@/lib/audit/schema.js').AuditActor} AuditActor
 * @typedef {import('@/lib/audit/schema.js').AuditSource} AuditSource
 */

/** Firestore caps a batch at 500 writes. */
const WRITE_BATCH_LIMIT = 450;

const AUDIT_CONTEXT = { builderPath: "/builder/admin/email", section: "email" };

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

/** @returns {string} */
export function generateUnsubscribeToken() {
  return randomBytes(24).toString("hex");
}

/**
 * @returns {Promise<Array<EmailSubscriber & { id: string }>>}
 */
export async function listSubscribers() {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.emailSubscribers).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...normalizeSubscriber(doc.data()) }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * Addresses that should receive the next send, each with the token its
 * unsubscribe link needs. Missing tokens are backfilled so older rows keep
 * working.
 *
 * @returns {Promise<Array<{ id: string, email: string, name: string, unsubscribeToken: string }>>}
 */
export async function listSendableSubscribers() {
  const db = getDb();
  const subscribers = (await listSubscribers()).filter((s) => s.status === "subscribed");

  const missingToken = subscribers.filter((s) => !s.unsubscribeToken);
  if (missingToken.length > 0) {
    for (let i = 0; i < missingToken.length; i += WRITE_BATCH_LIMIT) {
      const batch = db.batch();
      for (const subscriber of missingToken.slice(i, i + WRITE_BATCH_LIMIT)) {
        subscriber.unsubscribeToken = generateUnsubscribeToken();
        batch.update(db.collection(COLLECTIONS.emailSubscribers).doc(subscriber.id), {
          unsubscribeToken: subscriber.unsubscribeToken,
          updatedAt: now(),
        });
      }
      await batch.commit();
    }
  }

  return subscribers.map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    unsubscribeToken: s.unsubscribeToken,
  }));
}

/**
 * @returns {Promise<{ total: number, subscribed: number, unsubscribed: number, bounced: number }>}
 */
export async function getSubscriberStats() {
  return summarizeSubscribers(await listSubscribers());
}

/**
 * Add or update people on the list. Repeat imports are idempotent: an address
 * already on the list keeps its status unless `resubscribe` is set, so an
 * accidental re-import never mails someone who opted out.
 *
 * @param {Array<{ email: string, name?: string }>} entries
 * @param {{
 *   source?: EmailSubscriberSource,
 *   resubscribe?: boolean,
 *   actor?: AuditActor,
 *   auditSource?: AuditSource,
 * }} [options]
 * @returns {Promise<{ added: number, updated: number, skipped: number, invalid: string[] }>}
 */
export async function addSubscribers(entries, options = {}) {
  const db = getDb();
  const collection = db.collection(COLLECTIONS.emailSubscribers);
  const source = normalizeSubscriberSource(options.source);
  const timestamp = now();

  /** @type {string[]} */
  const invalid = [];
  /** @type {Map<string, { email: string, name: string }>} */
  const unique = new Map();

  for (const entry of entries || []) {
    const email = normalizeEmail(entry?.email);
    if (!isValidEmail(email)) {
      if (email) invalid.push(email);
      continue;
    }
    unique.set(email, { email, name: typeof entry?.name === "string" ? entry.name.trim() : "" });
  }

  const candidates = [...unique.values()];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i += WRITE_BATCH_LIMIT) {
    const slice = candidates.slice(i, i + WRITE_BATCH_LIMIT);
    const refs = slice.map((entry) => collection.doc(subscriberDocId(entry.email)));
    const snaps = await db.getAll(...refs);
    const batch = db.batch();

    slice.forEach((entry, index) => {
      const snap = snaps[index];
      const existing = snap.exists ? normalizeSubscriber(snap.data()) : null;

      if (!existing) {
        batch.set(refs[index], {
          email: entry.email,
          name: entry.name,
          status: "subscribed",
          source,
          unsubscribeToken: generateUnsubscribeToken(),
          createdAt: timestamp,
          updatedAt: timestamp,
          unsubscribedAt: "",
          lastSentAt: "",
          note: "",
        });
        added += 1;
        return;
      }

      const keepsOptOut = existing.status !== "subscribed" && !options.resubscribe;
      const nameChanged = Boolean(entry.name) && entry.name !== existing.name;

      if (keepsOptOut && !nameChanged) {
        skipped += 1;
        return;
      }

      batch.update(refs[index], {
        ...(nameChanged ? { name: entry.name } : {}),
        ...(keepsOptOut
          ? {}
          : { status: "subscribed", unsubscribedAt: "" }),
        ...(existing.unsubscribeToken ? {} : { unsubscribeToken: generateUnsubscribeToken() }),
        updatedAt: timestamp,
      });
      updated += 1;
    });

    await batch.commit();
  }

  if (added > 0 || updated > 0) {
    await recordAuditEvent({
      action: "create",
      actor: options.actor,
      source: options.auditSource,
      resource: {
        type: "email_subscriber",
        path: COLLECTIONS.emailSubscribers,
        apiRoute: "/api/admin/email-list/subscribers",
      },
      summary: `Added ${added} and updated ${updated} email list subscriber(s)`,
      after: { added, updated, skipped, emails: candidates.slice(0, 50).map((e) => e.email) },
      context: AUDIT_CONTEXT,
    });
  }

  return { added, updated, skipped, invalid };
}

/**
 * @param {string} subscriberId
 * @param {{ name?: string, status?: EmailSubscriberStatus, note?: string }} patch
 * @param {{ actor?: AuditActor, auditSource?: AuditSource }} [options]
 * @returns {Promise<EmailSubscriber & { id: string }>}
 */
export async function updateSubscriber(subscriberId, patch, options = {}) {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.emailSubscribers).doc(String(subscriberId || "").trim());
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Subscriber not found.");

  const before = normalizeSubscriber(snap.data());
  const timestamp = now();
  /** @type {Record<string, unknown>} */
  const update = { updatedAt: timestamp };

  if (typeof patch.name === "string") update.name = patch.name.trim();
  if (typeof patch.note === "string") update.note = patch.note.trim();
  if (patch.status !== undefined) {
    const status = normalizeSubscriberStatus(patch.status);
    update.status = status;
    update.unsubscribedAt = status === "subscribed" ? "" : timestamp;
    if (status === "subscribed" && !before.unsubscribeToken) {
      update.unsubscribeToken = generateUnsubscribeToken();
    }
  }

  await ref.update(update);
  const after = normalizeSubscriber({ ...before, ...update });

  await recordAuditEvent({
    action: "update",
    actor: options.actor,
    source: options.auditSource,
    resource: {
      type: "email_subscriber",
      id: ref.id,
      path: `${COLLECTIONS.emailSubscribers}/${ref.id}`,
      apiRoute: "/api/admin/email-list/subscribers",
    },
    summary: `Updated email list subscriber ${before.email}`,
    before,
    after,
    context: AUDIT_CONTEXT,
  });

  return { id: ref.id, ...after };
}

/**
 * @param {string} subscriberId
 * @param {{ actor?: AuditActor, auditSource?: AuditSource }} [options]
 * @returns {Promise<{ deleted: string }>}
 */
export async function removeSubscriber(subscriberId, options = {}) {
  const db = getDb();
  const id = String(subscriberId || "").trim();
  if (!id) throw new Error("subscriberId is required.");

  const ref = db.collection(COLLECTIONS.emailSubscribers).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Subscriber not found.");

  const before = normalizeSubscriber(snap.data());
  await ref.delete();

  await recordAuditEvent({
    action: "delete",
    actor: options.actor,
    source: options.auditSource,
    resource: {
      type: "email_subscriber",
      id,
      path: `${COLLECTIONS.emailSubscribers}/${id}`,
      apiRoute: "/api/admin/email-list/subscribers",
    },
    summary: `Removed ${before.email} from the email list`,
    before,
    context: AUDIT_CONTEXT,
  });

  return { deleted: id };
}

/**
 * Honour an unsubscribe link. Tokens are single-purpose secrets, so no session
 * is involved and an unknown token simply reports "not found".
 *
 * @param {string} token
 * @returns {Promise<{ ok: boolean, email: string, alreadyUnsubscribed: boolean }>}
 */
export async function unsubscribeByToken(token) {
  const db = getDb();
  const value = String(token || "").trim();
  if (!value) return { ok: false, email: "", alreadyUnsubscribed: false };

  const snap = await db
    .collection(COLLECTIONS.emailSubscribers)
    .where("unsubscribeToken", "==", value)
    .limit(1)
    .get();

  if (snap.empty) return { ok: false, email: "", alreadyUnsubscribed: false };

  const doc = snap.docs[0];
  const subscriber = normalizeSubscriber(doc.data());

  if (subscriber.status === "unsubscribed") {
    return { ok: true, email: subscriber.email, alreadyUnsubscribed: true };
  }

  const timestamp = now();
  await doc.ref.update({ status: "unsubscribed", unsubscribedAt: timestamp, updatedAt: timestamp });

  return { ok: true, email: subscriber.email, alreadyUnsubscribed: false };
}

/**
 * Record that a send went out, so the admin can see who was last mailed.
 *
 * @param {string[]} subscriberIds
 * @returns {Promise<void>}
 */
export async function markSubscribersSent(subscriberIds) {
  const db = getDb();
  const ids = subscriberIds.filter(Boolean);
  const timestamp = now();

  for (let i = 0; i < ids.length; i += WRITE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const id of ids.slice(i, i + WRITE_BATCH_LIMIT)) {
      batch.update(db.collection(COLLECTIONS.emailSubscribers).doc(id), { lastSentAt: timestamp });
    }
    await batch.commit();
  }
}
