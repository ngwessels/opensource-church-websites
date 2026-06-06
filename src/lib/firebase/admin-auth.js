import "server-only";

import { getAuth } from "firebase-admin/auth";

import { getFirebaseAdminApp } from "@/lib/firebase/admin";

export async function verifyFirebaseIdToken(idToken) {
  const app = getFirebaseAdminApp();
  if (!app) throw new Error("Firebase Admin is not configured");
  return getAuth(app).verifyIdToken(idToken);
}
