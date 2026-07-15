import "server-only";

import { randomUUID } from "node:crypto";

import { recordAuditEvent } from "@/lib/audit/record.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getFirebaseAdminStorage } from "@/lib/firebase/admin-storage";
import { COLLECTIONS } from "@/lib/firestore/paths";
import {
  MAX_CHUNK_BASE64_CHARS,
  MAX_CHUNKED_UPLOAD_BYTES,
  MAX_SINGLE_SHOT_BYTES,
  MAX_SOURCE_URL_BYTES,
  RECOMMENDED_CHUNK_BYTES,
  decodeBase64Media,
  normalizeBase64Payload,
  validateMagicBytes,
} from "@/lib/media/decode-base64";
import { buildMediaMetadataFields, normalizeMediaMetadata } from "@/lib/media/metadata";

const UPLOAD_SESSION_TTL_MS = 60 * 60 * 1000;
const UPLOAD_SESSIONS = "mediaUploadSessions";
const UPLOAD_CHUNKS = "chunks";

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
  const before = await getMediaAdmin(mediaId);
  await getDb().collection(COLLECTIONS.media).doc(mediaId).delete();

  await recordAuditEvent({
    action: "delete",
    resource: { type: "media", id: mediaId },
    summary: `Deleted media ${before.name || mediaId}`,
    before,
  });

  return { deleted: mediaId };
}

export async function updateMediaAdmin(mediaId, fields) {
  const before = await getMediaAdmin(mediaId);
  const patch = normalizeMediaMetadata(fields);
  if (Object.keys(patch).length === 0) {
    throw new Error("No metadata fields to update");
  }

  await getDb()
    .collection(COLLECTIONS.media)
    .doc(mediaId)
    .update({ ...patch, updatedAt: now() });

  const after = await getMediaAdmin(mediaId);

  await recordAuditEvent({
    action: "update",
    resource: { type: "media", id: mediaId },
    summary: `Updated media ${after.name || mediaId}`,
    before,
    after,
  });

  return after;
}

async function uploadBufferToStorage(buffer, { filename, mimeType, folderId, metadata = {} }) {
  const storage = getFirebaseAdminStorage();
  if (!storage) throw new Error("Firebase Admin Storage is not configured");

  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const storagePath = `media/${folderId}/${mediaId}_${filename}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const downloadToken = randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  const downloadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}` +
    `?alt=media&token=${downloadToken}`;

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
  const created = { id: mediaId, ...record };

  await recordAuditEvent({
    action: "create",
    resource: { type: "media", id: mediaId },
    summary: `Uploaded media ${filename}`,
    after: created,
  });

  return created;
}

/**
 * @param {{
 *   base64?: string,
 *   sourceUrl?: string,
 *   filename: string,
 *   mimeType?: string,
 *   folderId: string,
 *   description?: string,
 *   alt?: string,
 *   tags?: string[],
 *   expectedSizeBytes?: number,
 * }} args
 */
export async function uploadMediaAdmin({
  base64,
  sourceUrl,
  filename,
  mimeType,
  folderId,
  description,
  alt,
  tags,
  expectedSizeBytes,
}) {
  if (!folderId) throw new Error("folderId is required");
  if (!filename) throw new Error("filename is required");

  const metadata = { description, alt, tags };

  if (base64) {
    if (expectedSizeBytes == null) {
      throw new Error(
        "expectedSizeBytes is required for base64 uploads. " +
          "Pass the original file size in bytes so truncated tool-call payloads are rejected. " +
          "For files over ~100KB (or anything near Vercel's 4.5 MB request limit), use " +
          "begin_media_upload / upload_media_chunk / complete_media_upload, or sourceUrl.",
      );
    }

    const { buffer, mimeType: resolvedMime } = decodeBase64Media(base64, {
      filename,
      mimeType,
      expectedSizeBytes,
      maxBytes: MAX_SINGLE_SHOT_BYTES,
    });

    return uploadBufferToStorage(buffer, {
      filename,
      mimeType: resolvedMime,
      folderId,
      metadata,
    });
  }

  if (sourceUrl) {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Failed to fetch sourceUrl: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_SOURCE_URL_BYTES) {
      throw new Error(
        `File exceeds ${MAX_SOURCE_URL_BYTES / (1024 * 1024)} MB limit for sourceUrl upload`,
      );
    }
    if (expectedSizeBytes != null && buffer.length !== Number(expectedSizeBytes)) {
      throw new Error(
        `Size mismatch: fetched ${buffer.length} bytes but expectedSizeBytes was ${expectedSizeBytes}`,
      );
    }
    const type = mimeType || res.headers.get("content-type") || "application/octet-stream";
    validateMagicBytes(buffer, type, filename);
    return uploadBufferToStorage(buffer, { filename, mimeType: type, folderId, metadata });
  }

  throw new Error("base64 or sourceUrl is required");
}

/**
 * @param {{ files: Array<{ folderId: string, filename: string, mimeType?: string, base64?: string, sourceUrl?: string, description?: string, alt?: string, tags?: string[], expectedSizeBytes?: number }> }} input
 */
export async function uploadMediaBatchAdmin({ files }) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files array is required");
  }

  const uploaded = [];
  const errors = [];

  for (let index = 0; index < files.length; index += 1) {
    try {
      const result = await uploadMediaAdmin(files[index]);
      uploaded.push(result);
    } catch (err) {
      errors.push({
        index,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { uploaded, errors };
}

async function deleteUploadSession(db, uploadId) {
  const sessionRef = db.collection(UPLOAD_SESSIONS).doc(uploadId);
  const chunksSnap = await sessionRef.collection(UPLOAD_CHUNKS).get();
  const batchSize = 400;
  let batch = db.batch();
  let ops = 0;

  for (const doc of chunksSnap.docs) {
    batch.delete(doc.ref);
    ops += 1;
    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  batch.delete(sessionRef);
  ops += 1;
  await batch.commit();
}

/**
 * Start a chunked upload session. Use when base64 cannot fit reliably in one MCP tool call.
 * @param {{
 *   folderId: string,
 *   filename: string,
 *   mimeType?: string,
 *   expectedSizeBytes: number,
 *   description?: string,
 *   alt?: string,
 *   tags?: string[],
 * }} args
 */
export async function beginMediaUploadAdmin({
  folderId,
  filename,
  mimeType,
  expectedSizeBytes,
  description,
  alt,
  tags,
}) {
  if (!folderId) throw new Error("folderId is required");
  if (!filename) throw new Error("filename is required");
  const expected = Number(expectedSizeBytes);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("expectedSizeBytes must be a positive integer");
  }
  if (expected > MAX_CHUNKED_UPLOAD_BYTES) {
    throw new Error(
      `File exceeds ${MAX_CHUNKED_UPLOAD_BYTES / (1024 * 1024)} MB limit for chunked upload. Use sourceUrl for larger files.`,
    );
  }

  const db = getDb();
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = now();
  const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_MS).toISOString();

  await db.collection(UPLOAD_SESSIONS).doc(uploadId).set({
    folderId,
    filename,
    mimeType: mimeType || "application/octet-stream",
    expectedSizeBytes: expected,
    receivedBytes: 0,
    receivedChunkCount: 0,
    status: "open",
    metadata: { description, alt, tags },
    createdAt,
    expiresAt,
  });

  return {
    uploadId,
    expectedSizeBytes: expected,
    expiresAt,
    recommendedChunkBytes: RECOMMENDED_CHUNK_BYTES,
    maxChunkBase64Chars: MAX_CHUNK_BASE64_CHARS,
    nextChunkIndex: 0,
    instructions:
      "Split the file into binary chunks of ~96KB (Vercel MCP bodies are limited to ~4.5 MB). Base64-encode each chunk separately (not the whole file). Call upload_media_chunk for index 0, 1, 2… then complete_media_upload. Prefer sourceUrl when the file is already hosted.",
  };
}

/**
 * @param {{ uploadId: string, chunkIndex: number, base64: string }} args
 */
export async function uploadMediaChunkAdmin({ uploadId, chunkIndex, base64 }) {
  if (!uploadId) throw new Error("uploadId is required");
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error("chunkIndex must be a non-negative integer");
  }
  if (typeof base64 !== "string" || !base64.trim()) {
    throw new Error("base64 chunk is required");
  }

  const { base64: cleaned } = normalizeBase64Payload(base64);
  if (cleaned.length > MAX_CHUNK_BASE64_CHARS) {
    throw new Error(
      `Chunk base64 exceeds ${MAX_CHUNK_BASE64_CHARS} characters (~${Math.round(MAX_CHUNK_BASE64_CHARS * 0.75 / 1024)} KB decoded). ` +
        `Vercel request bodies are capped at ~4.5 MB. Use smaller chunks (~${Math.round(RECOMMENDED_CHUNK_BYTES / 1024)} KB binary).`,
    );
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error("base64 chunk contains invalid characters");
  }

  const chunkBuffer = Buffer.from(cleaned, "base64");
  if (chunkBuffer.length === 0) {
    throw new Error("Decoded chunk is empty");
  }

  const db = getDb();
  const sessionRef = db.collection(UPLOAD_SESSIONS).doc(uploadId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error("Upload session not found");
  const session = sessionSnap.data();
  if (session.status !== "open") throw new Error(`Upload session is ${session.status}`);
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await deleteUploadSession(db, uploadId);
    throw new Error("Upload session expired");
  }

  const chunkRef = sessionRef.collection(UPLOAD_CHUNKS).doc(String(chunkIndex));
  const existing = await chunkRef.get();
  if (existing.exists) {
    throw new Error(`Chunk ${chunkIndex} was already uploaded`);
  }

  const nextReceived = (session.receivedBytes || 0) + chunkBuffer.length;
  if (nextReceived > session.expectedSizeBytes) {
    throw new Error(
      `Chunk would exceed expectedSizeBytes (${session.expectedSizeBytes}); got ${nextReceived} bytes so far`,
    );
  }

  await chunkRef.set({
    chunkIndex,
    base64: cleaned,
    sizeBytes: chunkBuffer.length,
    createdAt: now(),
  });

  await sessionRef.update({
    receivedBytes: nextReceived,
    receivedChunkCount: (session.receivedChunkCount || 0) + 1,
    updatedAt: now(),
  });

  return {
    uploadId,
    chunkIndex,
    chunkBytes: chunkBuffer.length,
    receivedBytes: nextReceived,
    expectedSizeBytes: session.expectedSizeBytes,
    remainingBytes: session.expectedSizeBytes - nextReceived,
    nextChunkIndex: chunkIndex + 1,
  };
}

/**
 * @param {{ uploadId: string }} args
 */
export async function completeMediaUploadAdmin({ uploadId }) {
  if (!uploadId) throw new Error("uploadId is required");

  const db = getDb();
  const sessionRef = db.collection(UPLOAD_SESSIONS).doc(uploadId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error("Upload session not found");
  const session = sessionSnap.data();
  if (session.status !== "open") throw new Error(`Upload session is ${session.status}`);
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await deleteUploadSession(db, uploadId);
    throw new Error("Upload session expired");
  }

  const chunksSnap = await sessionRef.collection(UPLOAD_CHUNKS).get();
  if (chunksSnap.empty) throw new Error("No chunks uploaded");

  const ordered = chunksSnap.docs
    .map((d) => d.data())
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  const indexes = ordered.map((d) => d.chunkIndex);
  for (let i = 0; i < indexes.length; i += 1) {
    if (indexes[i] !== i) {
      throw new Error(`Missing chunk ${i} (have ${indexes.join(", ")})`);
    }
  }

  const parts = ordered.map((d) => Buffer.from(d.base64, "base64"));
  const buffer = Buffer.concat(parts);

  if (buffer.length !== session.expectedSizeBytes) {
    throw new Error(
      `Assembled size ${buffer.length} does not match expectedSizeBytes ${session.expectedSizeBytes}`,
    );
  }

  validateMagicBytes(buffer, session.mimeType, session.filename);

  await sessionRef.update({ status: "completing", updatedAt: now() });

  try {
    const created = await uploadBufferToStorage(buffer, {
      filename: session.filename,
      mimeType: session.mimeType,
      folderId: session.folderId,
      metadata: session.metadata || {},
    });
    await deleteUploadSession(db, uploadId);
    return created;
  } catch (err) {
    await sessionRef.update({ status: "open", updatedAt: now() });
    throw err;
  }
}
