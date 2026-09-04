import "server-only";

import { randomUUID } from "node:crypto";

import { recordAuditEvent } from "@/lib/audit/record.server";
import { getMcpAuthContext, mcpAuthStorage } from "@/lib/cms/auth";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getFirebaseAdminStorage } from "@/lib/firebase/admin-storage";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { buildMediaMetadataFields, normalizeMediaMetadata } from "@/lib/media/metadata";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  UPLOAD_LINK_TTL_MS,
  assertAllowedFolderId,
  buildUploadUrl,
  defaultMimeTypeHint,
  generateUploadToken,
  hashUploadToken,
  publicUploadLinkView,
  resolveUploadLinkStatus,
  sanitizeUploadFilename,
} from "@/lib/media/upload-link";
import { validateMagicBytes } from "@/lib/media/validate-file";
import { getSiteBaseUrlServer } from "@/lib/seo/site-url.server";

const SIGNED_PUT_TTL_MS = 15 * 60 * 1000;

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

function getStorageBucket() {
  const storage = getFirebaseAdminStorage();
  if (!storage) throw new Error("Firebase Admin Storage is not configured");
  return storage.bucket();
}

function linkRef(tokenHash) {
  return getDb().collection(COLLECTIONS.mediaUploadLinks).doc(tokenHash);
}

async function siteBaseUrl() {
  return getSiteBaseUrlServer();
}

function createdByFromMcp() {
  try {
    const ctx = getMcpAuthContext();
    return {
      uid: ctx.uid || null,
      connectionId: ctx.connectionId || null,
    };
  } catch {
    return { uid: null, connectionId: null };
  }
}

/**
 * @param {object} session
 * @param {() => Promise<T>} fn
 * @template T
 */
async function withLinkActor(session, fn) {
  const createdBy = session?.createdBy || {};
  if (createdBy.uid) {
    return mcpAuthStorage.run(
      {
        uid: createdBy.uid,
        connectionId: createdBy.connectionId,
        authMethod: "oauth",
        toolName: "create_media_upload_link",
      },
      fn,
    );
  }
  return fn();
}

function downloadUrlFor(bucketName, storagePath, downloadToken) {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}` +
    `?alt=media&token=${downloadToken}`
  );
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

/**
 * @param {Buffer} buffer
 * @param {{ filename: string, mimeType: string, folderId: string, metadata?: object }} opts
 */
export async function uploadBufferToStorage(buffer, { filename, mimeType, folderId, metadata = {} }) {
  const bucket = getStorageBucket();
  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const safeName = sanitizeUploadFilename(filename);
  const storagePath = `media/${folderId}/${mediaId}_${safeName}`;
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

  const record = {
    name: safeName,
    folderId,
    mimeType,
    sizeBytes: buffer.length,
    storagePath,
    downloadUrl: downloadUrlFor(bucket.name, storagePath, downloadToken),
    usedOnPageIds: [],
    ...buildMediaMetadataFields(metadata),
    createdAt: now(),
  };

  await getDb().collection(COLLECTIONS.media).doc(mediaId).set(record);
  const created = { id: mediaId, ...record };

  await recordAuditEvent({
    action: "create",
    resource: { type: "media", id: mediaId },
    summary: `Uploaded media ${safeName}`,
    after: created,
  });

  return created;
}

/**
 * @param {{
 *   sourceUrl?: string,
 *   filename: string,
 *   mimeType?: string,
 *   folderId: string,
 *   description?: string,
 *   alt?: string,
 *   tags?: string[],
 * }} args
 */
export async function uploadMediaAdmin({
  sourceUrl,
  filename,
  mimeType,
  folderId,
  description,
  alt,
  tags,
}) {
  if (!folderId) throw new Error("folderId is required");
  assertAllowedFolderId(folderId);
  if (!filename) throw new Error("filename is required");
  if (!sourceUrl) {
    throw new Error(
      "sourceUrl is required. For local files use create_media_upload_link, open the returned uploadUrl in a browser, then call get_media_upload.",
    );
  }

  const metadata = { description, alt, tags };
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch sourceUrl: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }
  const type = mimeType || res.headers.get("content-type") || "application/octet-stream";
  validateMagicBytes(buffer, type, filename);
  return uploadBufferToStorage(buffer, { filename, mimeType: type, folderId, metadata });
}

/**
 * @param {{ files: Array<{ folderId: string, filename: string, mimeType?: string, sourceUrl?: string, description?: string, alt?: string, tags?: string[] }> }} input
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

async function loadLinkSession(token) {
  const tokenHash = hashUploadToken(token);
  const snap = await linkRef(tokenHash).get();
  if (!snap.exists) return { tokenHash, session: null };
  return { tokenHash, session: snap.data() };
}

async function linkView(token, session) {
  const baseUrl = await siteBaseUrl();
  return publicUploadLinkView({ token, baseUrl, session });
}

/**
 * @param {{
 *   folderId: string,
 *   filenameHint?: string,
 *   mimeTypeHint?: string,
 *   purpose?: string,
 *   description?: string,
 *   alt?: string,
 *   tags?: string[],
 * }} args
 */
export async function createMediaUploadLinkAdmin({
  folderId,
  filenameHint,
  mimeTypeHint,
  purpose,
  description,
  alt,
  tags,
}) {
  if (!folderId) throw new Error("folderId is required");
  assertAllowedFolderId(folderId);

  const token = generateUploadToken();
  const tokenHash = hashUploadToken(token);
  const createdAt = now();
  const expiresAt = new Date(Date.now() + UPLOAD_LINK_TTL_MS).toISOString();
  const createdBy = createdByFromMcp();
  const baseUrl = await siteBaseUrl();

  const session = {
    status: "waiting",
    folderId,
    filenameHint: typeof filenameHint === "string" ? filenameHint.trim() : "",
    mimeTypeHint:
      typeof mimeTypeHint === "string" && mimeTypeHint.trim()
        ? mimeTypeHint.trim()
        : defaultMimeTypeHint(folderId),
    purpose: typeof purpose === "string" ? purpose.trim() : "",
    maxFileBytes: MAX_MEDIA_UPLOAD_BYTES,
    metadata: { description, alt, tags },
    createdBy,
    tokenPrefix: token.slice(0, 8),
    createdAt,
    expiresAt,
  };

  await linkRef(tokenHash).set(session);

  const view = publicUploadLinkView({ token, baseUrl, session });
  return {
    uploadId: token,
    uploadUrl: buildUploadUrl(baseUrl, token),
    ...view,
    instructions:
      "Open uploadUrl in a browser (or Playwright). Choose a file and click Upload. Then call get_media_upload with this uploadId.",
  };
}

/**
 * @param {{ uploadId: string }} args
 */
export async function getMediaUploadAdmin({ uploadId }) {
  if (!uploadId) {
    return { status: "not_found", message: "uploadId is required.", uploadVerified: false };
  }
  try {
    const { session } = await loadLinkSession(uploadId);
    return linkView(uploadId, session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload link not found.";
    return { status: "not_found", message, uploadVerified: false };
  }
}

/**
 * Token-authenticated lookup for the public upload page/API.
 * @param {string} token
 */
export async function getMediaUploadLinkPublic(token) {
  return getMediaUploadAdmin({ uploadId: token });
}

/**
 * @param {object} session
 * @param {string} tokenHash
 */
function assertLinkAcceptsUpload(session) {
  const status = resolveUploadLinkStatus(session);
  if (status === "not_found") throw new Error("Upload link not found");
  if (status === "complete") throw new Error("This upload link was already used");
  if (status === "expired") throw new Error("This upload link has expired");
  if (status === "error") throw new Error(session.errorMessage || "Upload link is in an error state");
}

async function ensureBucketUploadCors(bucket) {
  const extraRule = {
    origin: ["*"],
    method: ["GET", "PUT", "POST", "HEAD", "OPTIONS"],
    responseHeader: ["Content-Type", "Content-Length", "x-goog-resumable"],
    maxAgeSeconds: 3600,
  };

  try {
    const [metadata] = await bucket.getMetadata();
    const rules = Array.isArray(metadata?.cors) ? metadata.cors : [];
    const ready = rules.some((rule) => {
      const methods = (rule.method || []).map((m) => String(m).toUpperCase());
      const origins = rule.origin || [];
      return (
        methods.includes("PUT") &&
        methods.includes("POST") &&
        (origins.includes("*") || origins.length > 0)
      );
    });
    if (ready) return;
    await bucket.setCorsConfiguration([...rules, extraRule]);
  } catch (err) {
    console.warn("[media] failed to ensure storage CORS for signed uploads", err);
  }
}

/**
 * App Hosting uses ADC, which cannot v4-sign without iam.serviceAccounts.signBlob.
 * Fall back to a resumable upload session URI — still a direct GCS PUT from the browser.
 *
 * @param {import("@google-cloud/storage").File} file
 * @param {string} contentType
 * @param {string} [origin]
 */
async function createBrowserWriteUrl(file, contentType, origin) {
  try {
    const [signedUploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + SIGNED_PUT_TTL_MS,
      contentType,
    });
    return signedUploadUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsIamSign =
      /signBlob|iam\.serviceAccounts\.signBlob|Cannot sign data without client email/i.test(message);
    if (!needsIamSign) throw err;

    /** @type {Record<string, unknown>} */
    const options = { metadata: { contentType } };
    if (origin) options.origin = origin;
    const [sessionUri] = await file.createResumableUpload(options);
    return sessionUri;
  }
}

/**
 * @param {string} token
 * @param {{ filename: string, mimeType?: string, sizeBytes: number, origin?: string }} fileInfo
 */
export async function prepareMediaUploadLinkSigned(token, { filename, mimeType, sizeBytes, origin }) {
  const { tokenHash, session } = await loadLinkSession(token);
  if (!session) throw new Error("Upload link not found");
  assertLinkAcceptsUpload(session);

  const expected = Number(sizeBytes);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("sizeBytes must be a positive integer");
  }
  if (expected > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }

  const safeName = sanitizeUploadFilename(filename || session.filenameHint);
  const type = mimeType || "application/octet-stream";
  const bucket = getStorageBucket();
  await ensureBucketUploadCors(bucket);

  const mediaId =
    session.reservedMediaId || `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const storagePath = session.storagePath || `media/${session.folderId}/${mediaId}_${safeName}`;
  const file = bucket.file(storagePath);
  const signedUploadUrl = await createBrowserWriteUrl(file, type, origin);

  await linkRef(tokenHash).update({
    status: "uploading",
    reservedMediaId: mediaId,
    storagePath,
    pendingFilename: safeName,
    pendingMimeType: type,
    expectedSizeBytes: expected,
    updatedAt: now(),
  });

  return {
    status: "uploading",
    signedUploadUrl,
    contentType: type,
    storagePath,
    mediaId,
    expectedSizeBytes: expected,
    uploadVerified: false,
  };
}

/**
 * @param {string} token
 */
export async function finalizeMediaUploadLinkSigned(token) {
  const { tokenHash, session } = await loadLinkSession(token);
  if (!session) throw new Error("Upload link not found");

  const status = resolveUploadLinkStatus(session);
  if (status === "complete") {
    return linkView(token, session);
  }
  if (status === "expired") throw new Error("This upload link has expired");
  if (status === "not_found") throw new Error("Upload link not found");
  if (!session.storagePath || !session.reservedMediaId) {
    throw new Error("No prepared upload found. Call prepare_signed first.");
  }

  const bucket = getStorageBucket();
  const file = bucket.file(session.storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("Storage upload was not found. PUT the file to signedUploadUrl, then finalize.");
  }

  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(metadata.size || 0);
  if (sizeBytes < 1) {
    throw new Error("Uploaded file is empty");
  }
  if (session.expectedSizeBytes && sizeBytes !== Number(session.expectedSizeBytes)) {
    throw new Error(
      `Uploaded size ${sizeBytes} does not match expected ${session.expectedSizeBytes} bytes`,
    );
  }
  if (sizeBytes > MAX_MEDIA_UPLOAD_BYTES) {
    await file.delete({ ignoreNotFound: true });
    throw new Error(`File exceeds ${MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }

  const previewEnd = Math.min(Math.max(sizeBytes - 1, 0), 31);
  const [head] = await file.download({ start: 0, end: previewEnd });
  const safeName = session.pendingFilename || sanitizeUploadFilename(session.filenameHint);
  const type = session.pendingMimeType || metadata.contentType || "application/octet-stream";
  validateMagicBytes(head, type, safeName);

  const downloadToken = randomUUID();
  await file.setMetadata({
    contentType: type,
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
    },
  });

  const mediaId = session.reservedMediaId;
  const record = {
    name: safeName,
    folderId: session.folderId,
    mimeType: type,
    sizeBytes,
    storagePath: session.storagePath,
    downloadUrl: downloadUrlFor(bucket.name, session.storagePath, downloadToken),
    usedOnPageIds: [],
    ...buildMediaMetadataFields(session.metadata || {}),
    createdAt: now(),
  };

  const created = { id: mediaId, ...record };
  const media = {
    id: created.id,
    name: created.name,
    mimeType: created.mimeType,
    sizeBytes: created.sizeBytes,
    folderId: created.folderId,
    downloadUrl: created.downloadUrl,
  };

  await withLinkActor(session, async () => {
    await getDb().collection(COLLECTIONS.media).doc(mediaId).set(record);
    await recordAuditEvent({
      action: "create",
      resource: { type: "media", id: mediaId },
      summary: `Uploaded media ${safeName}`,
      after: created,
    });
  });

  await linkRef(tokenHash).update({
    status: "complete",
    mediaId,
    media,
    updatedAt: now(),
  });

  return linkView(token, { ...session, status: "complete", mediaId, media });
}

export { MAX_MEDIA_UPLOAD_BYTES };
