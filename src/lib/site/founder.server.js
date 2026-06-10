import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getFounderUserId } from "@/lib/site/founder";
import { COLLECTIONS } from "@/lib/firestore/paths";

/** @returns {Promise<string | null>} */
export async function getFounderUserIdServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;

  const flaggedSnap = await db.collection(COLLECTIONS.users).where("isFounder", "==", true).limit(1).get();
  if (!flaggedSnap.empty) {
    return flaggedSnap.docs[0].id;
  }

  const allSnap = await db.collection(COLLECTIONS.users).get();
  const users = allSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return getFounderUserId(users);
}

/** @param {string} uid */
export async function isFounderUserServer(uid) {
  const founderId = await getFounderUserIdServer();
  return founderId != null && founderId === uid;
}
