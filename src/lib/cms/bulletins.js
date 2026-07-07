import "server-only";

import { revalidatePublicBulletins } from "@/lib/cache/revalidate-public";
import { recordAuditEvent } from "@/lib/audit/record.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { listBulletinsServer } from "@/lib/firestore/server";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

function generateBulletinId() {
  return `bulletin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function listBulletinsAdmin() {
  return listBulletinsServer();
}

/**
 * @param {{ date: string, title?: string, mediaId: string, downloadUrl: string }} input
 */
export async function createBulletinAdmin(input) {
  const date = input.date?.trim();
  const mediaId = input.mediaId?.trim();
  const downloadUrl = input.downloadUrl?.trim();
  const title = input.title?.trim();

  if (!date) throw new Error("Publish date is required.");
  if (!mediaId) throw new Error("mediaId is required.");
  if (!downloadUrl) throw new Error("downloadUrl is required.");

  const db = getDb();
  const duplicate = await db
    .collection(COLLECTIONS.bulletins)
    .where("date", "==", date)
    .limit(1)
    .get();

  if (!duplicate.empty) {
    throw new Error("A bulletin already exists for this date.");
  }

  const bulletinId = generateBulletinId();
  const timestamp = now();
  const record = {
    date,
    ...(title ? { title } : {}),
    mediaId,
    downloadUrl,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.collection(COLLECTIONS.bulletins).doc(bulletinId).set(record);
  revalidatePublicBulletins();

  const created = { id: bulletinId, ...record };

  await recordAuditEvent({
    action: "create",
    resource: { type: "bulletin", id: bulletinId },
    summary: `Created bulletin for ${date}`,
    after: created,
  });

  return created;
}

export async function deleteBulletinAdmin(bulletinId) {
  const id = bulletinId?.trim();
  if (!id) throw new Error("bulletinId is required.");

  const db = getDb();
  const ref = db.collection(COLLECTIONS.bulletins).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Bulletin not found.");

  const before = { id: snap.id, ...snap.data() };
  await ref.delete();
  revalidatePublicBulletins();

  await recordAuditEvent({
    action: "delete",
    resource: { type: "bulletin", id },
    summary: `Deleted bulletin ${id}`,
    before,
  });

  return { deleted: id };
}
