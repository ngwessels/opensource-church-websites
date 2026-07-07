import { doc } from "firebase/firestore";

import { auditedUpdateDoc } from "@/lib/firestore/audited-mutation";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizeMediaMetadata } from "@/lib/media/metadata";

export async function updateMediaMetadata(db, mediaId, fields, audit) {
  const patch = normalizeMediaMetadata(fields);
  if (Object.keys(patch).length === 0) return;

  const updates = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (audit) {
    await auditedUpdateDoc(doc(db, COLLECTIONS.media, mediaId), updates, audit);
    return;
  }

  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, COLLECTIONS.media, mediaId), updates);
}
