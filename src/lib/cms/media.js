import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getFirebaseAdminStorage } from "@/lib/firebase/admin-storage";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { buildMediaMetadataFields, normalizeMediaMetadata } from "@/lib/media/metadata";

const MAX_BASE64_BYTES = 3 * 1024 * 1024;

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

export async function listMediaAdmin({ folderId } = {}) {
  const db = getDb();
  let query = db.collection(COLLECTIONS.media);
  if (folderId) {
    query = query.where("folderId", "==", folderId);
  }
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listMediaFoldersAdmin() {
  const snap = await getDb().collection(COLLECTIONS.mediaFolders).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMediaAdmin(mediaId) {
  const snap = await getDb().collection(COLLECTIONS.media).doc(mediaId).get();
  if (!snap.exists) throw new Error("Media not found");
  return { id: snap.id, ...snap.data() };
}

export async function deleteMediaAdmin(mediaId) {
  await getDb().collection(COLLECTIONS.media).doc(mediaId).delete();
  return { deleted: mediaId };
}

export async function updateMediaAdmin(mediaId, fields) {
  const patch = normalizeMediaMetadata(fields);
  if (Object.keys(patch).length === 0) {
    throw new Error("No metadata fields to update");
  }

  await getDb()
    .collection(COLLECTIONS.media)
    .doc(mediaId)
    .update({ ...patch, updatedAt: now() });

  return getMediaAdmin(mediaId);
}

async function uploadBufferToStorage(buffer, { filename, mimeType, folderId, metadata = {} }) {
  const storage = getFirebaseAdminStorage();
  if (!storage) throw new Error("Firebase Admin Storage is not configured");

  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const storagePath = `media/${folderId}/${mediaId}_${filename}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
    public: true,
  });

  await file.makePublic();
  const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  const record = {
    name: filename,
    folderId,
    mimeType,
    sizeBytes: buffer.length,
    storagePath,
    downloadUrl,
    usedOnPageIds: [],
    ...buildMediaMetadataFields(metadata),
    createdAt: now(),
  };

  await getDb().collection(COLLECTIONS.media).doc(mediaId).set(record);
  return { id: mediaId, ...record };
}

export async function uploadMediaAdmin({
  base64,
  sourceUrl,
  filename,
  mimeType,
  folderId,
  description,
  alt,
  tags,
}) {
  if (!folderId) throw new Error("folderId is required");
  if (!filename) throw new Error("filename is required");

  const metadata = { description, alt, tags };

  if (base64) {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > MAX_BASE64_BYTES) {
      throw new Error(`File exceeds ${MAX_BASE64_BYTES / (1024 * 1024)} MB limit for base64 upload`);
    }
    return uploadBufferToStorage(buffer, {
      filename,
      mimeType: mimeType || "application/octet-stream",
      folderId,
      metadata,
    });
  }

  if (sourceUrl) {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Failed to fetch sourceUrl: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error("File exceeds 10 MB limit for sourceUrl upload");
    }
    const type = mimeType || res.headers.get("content-type") || "application/octet-stream";
    return uploadBufferToStorage(buffer, { filename, mimeType: type, folderId, metadata });
  }

  throw new Error("base64 or sourceUrl is required");
}
