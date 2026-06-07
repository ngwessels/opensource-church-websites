import "server-only";

import { randomUUID } from "node:crypto";

import { getFirebaseAdminStorage } from "@/lib/firebase/admin-storage";

/**
 * @param {Buffer} buffer
 * @param {{ formId: string, submissionId: string, fieldId: string, filename: string, mimeType: string }}
 * @returns {Promise<{ name: string, storagePath: string, sizeBytes: number, downloadUrl: string }>}
 */
export async function uploadFormFile(buffer, { formId, submissionId, fieldId, filename, mimeType }) {
  const storage = getFirebaseAdminStorage();
  if (!storage) throw new Error("Firebase Admin Storage is not configured");

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `form-uploads/${formId}/${submissionId}/${fieldId}_${safeName}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const downloadToken = randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: mimeType || "application/octet-stream",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  const downloadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}` +
    `?alt=media&token=${downloadToken}`;

  return {
    name: filename,
    storagePath,
    sizeBytes: buffer.length,
    downloadUrl,
  };
}
