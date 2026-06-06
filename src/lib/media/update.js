import { doc, updateDoc } from "firebase/firestore";

import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizeMediaMetadata } from "@/lib/media/metadata";

export async function updateMediaMetadata(db, mediaId, fields) {
  const patch = normalizeMediaMetadata(fields);
  if (Object.keys(patch).length === 0) return;

  await updateDoc(doc(db, COLLECTIONS.media, mediaId), {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}
