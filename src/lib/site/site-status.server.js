import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

/** @returns {Promise<boolean>} True when at least one user profile exists. */
export async function isSiteInitialized() {
  const db = getFirebaseAdminFirestore();
  if (!db) return false;

  const usersSnap = await db.collection(COLLECTIONS.users).limit(1).get();
  return !usersSnap.empty;
}
