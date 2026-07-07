import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc } from "firebase/firestore";

import { getFirebaseStorage } from "@/lib/firebase/storage";
import { auditedSetDoc } from "@/lib/firestore/audited-mutation";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { buildMediaMetadataFields } from "@/lib/media/metadata";

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {File} file
 * @param {string} folderId
 * @param {(pct: number) => void} [onProgress]
 * @param {{ description?: string, alt?: string, tags?: string | string[] }} [metadata]
 * @param {import('@/lib/firestore/audited-mutation').AuditMeta} [audit]
 */
export function uploadMediaFile(db, file, folderId, onProgress, metadata = {}, audit) {
  const storage = getFirebaseStorage();
  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const storagePath = `media/${folderId}/${mediaId}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (onProgress) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const record = {
          name: file.name,
          folderId,
          mimeType: file.type,
          sizeBytes: file.size,
          storagePath,
          downloadUrl: url,
          usedOnPageIds: [],
          ...buildMediaMetadataFields(metadata),
          createdAt: new Date().toISOString(),
        };

        if (audit) {
          await auditedSetDoc(doc(db, COLLECTIONS.media, mediaId), record, audit);
        } else {
          const { setDoc } = await import("firebase/firestore");
          await setDoc(doc(db, COLLECTIONS.media, mediaId), record);
        }
        resolve({ id: mediaId, ...record });
      },
    );
  });
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
