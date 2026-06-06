import "server-only";

import { getStorage } from "firebase-admin/storage";

import { getFirebaseAdminApp } from "@/lib/firebase/admin";

export function getFirebaseAdminStorage() {
  const app = getFirebaseAdminApp();
  return app ? getStorage(app) : null;
}
