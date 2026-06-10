import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { buildSiteBootstrapData, buildUserProfileData } from "@/lib/site/bootstrap-data";

export class SiteInitializedError extends Error {
  constructor() {
    super("This site is closed to new signups. Contact your administrator.");
    this.code = "site_initialized";
  }
}

/**
 * Ensure a Firestore user profile exists for the authenticated user.
 * First user becomes admin and bootstraps the site; subsequent unsolicited signups are rejected.
 *
 * @param {{ uid: string, email?: string, displayName?: string }} user
 * @returns {Promise<{ role: "admin" | "member", bootstrapped: boolean }>}
 */
export async function ensureUserProfileServer(user) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const userRef = db.collection(COLLECTIONS.users).doc(user.uid);

  const existing = await userRef.get();
  if (existing.exists) {
    const role = existing.data()?.role === "admin" ? "admin" : "member";
    return { role, bootstrapped: false };
  }

  const usersSnap = await db.collection(COLLECTIONS.users).limit(1).get();
  if (!usersSnap.empty) {
    throw new SiteInitializedError();
  }

  const profile = buildUserProfileData(user, "admin");
  await userRef.set(profile);

  const bootstrapped = await ensureSiteBootstrappedServer();
  return { role: "admin", bootstrapped };
}

/** @returns {Promise<boolean>} */
export async function ensureSiteBootstrappedServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const siteRef = db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID);
  const siteSnap = await siteRef.get();
  if (siteSnap.exists) {
    return false;
  }

  const data = buildSiteBootstrapData();
  const batch = db.batch();

  batch.set(siteRef, data.siteConfig);
  batch.set(db.collection(COLLECTIONS.pages).doc(data.pageId), data.page);
  batch.set(db.collection(COLLECTIONS.navNodes).doc(data.homeNavId), data.navNode);

  for (const folder of data.mediaFolders) {
    batch.set(db.collection(COLLECTIONS.mediaFolders).doc(folder.id), folder.data);
  }

  await batch.commit();
  return true;
}
