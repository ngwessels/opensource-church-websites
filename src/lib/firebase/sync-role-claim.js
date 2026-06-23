import "server-only";

import { getAuth } from "firebase-admin/auth";

import { getFirebaseAdminApp } from "@/lib/firebase/admin";

/** @param {string} uid @param {"admin" | "member"} role */
export async function syncUserRoleClaim(uid, role) {
  const app = getFirebaseAdminApp();
  if (!app) return false;

  try {
    const auth = getAuth(app);
    const user = await auth.getUser(uid);
    const existing = user.customClaims || {};
    if (existing.role === role) return false;

    await auth.setCustomUserClaims(uid, { ...existing, role });
    return true;
  } catch (err) {
    console.warn("[syncUserRoleClaim]", err);
    return false;
  }
}
