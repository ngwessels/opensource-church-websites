import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { syncUserRoleClaim } from "@/lib/firebase/sync-role-claim";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { normalizeUserRole } from "@/lib/auth/roles";
import { buildSiteBootstrapData, buildUserProfileData } from "@/lib/site/bootstrap-data";

/** @param {string} uid @param {import("@/types/firestore").UserRole} role */
async function ensureRoleClaim(uid, role) {
  await syncUserRoleClaim(uid, role);
}

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
 * @returns {Promise<{ role: import("@/types/firestore").UserRole, bootstrapped: boolean }>}
 */
export async function ensureUserProfileServer(user) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const userRef = db.collection(COLLECTIONS.users).doc(user.uid);

  const existing = await userRef.get();
  if (existing.exists) {
    const role = normalizeUserRole(existing.data()?.role);
    await ensureRoleClaim(user.uid, role);
    return { role, bootstrapped: false };
  }

  // Re-link profile when Firebase Auth uid changed but email matches an existing record.
  if (user.email) {
    const emailMatch = await db
      .collection(COLLECTIONS.users)
      .where("email", "==", user.email.trim())
      .limit(1)
      .get();
    if (!emailMatch.empty) {
      const legacy = emailMatch.docs[0];
      const data = legacy.data();
      const now = new Date().toISOString();
      const role = normalizeUserRole(data?.role);
      await userRef.set({
        email: data.email || user.email,
        displayName: data.displayName || user.displayName || "",
        role,
        ...(data.isFounder ? { isFounder: true } : {}),
        createdAt: data.createdAt || now,
        updatedAt: now,
      });
      if (legacy.id !== user.uid) {
        await legacy.ref.delete();
      }
      await ensureRoleClaim(user.uid, role);
      return { role, bootstrapped: false };
    }
  }

  const usersSnap = await db.collection(COLLECTIONS.users).limit(1).get();
  if (!usersSnap.empty) {
    throw new SiteInitializedError();
  }

  const profile = buildUserProfileData(user, "admin", { isFounder: true });
  await userRef.set(profile);

  const bootstrapped = await ensureSiteBootstrappedServer();
  await ensureRoleClaim(user.uid, "admin");
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
