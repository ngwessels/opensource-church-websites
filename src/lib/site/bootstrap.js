import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { buildSiteBootstrapData, buildUserProfileData } from "@/lib/site/bootstrap-data";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

/**
 * Client-side site bootstrap fallback for local dev when Admin SDK is unavailable.
 * @deprecated Prefer POST /api/auth/ensure-profile in production.
 */
export async function ensureSiteBootstrapped(db) {
  const siteRef = doc(db, COLLECTIONS.site, SITE_CONFIG_ID);
  const siteSnap = await getDoc(siteRef);

  if (siteSnap.exists()) {
    return false;
  }

  const data = buildSiteBootstrapData();
  const batch = writeBatch(db);

  batch.set(siteRef, data.siteConfig);
  batch.set(doc(db, COLLECTIONS.pages, data.pageId), data.page);
  batch.set(doc(db, COLLECTIONS.navNodes, data.homeNavId), data.navNode);

  for (const folder of data.mediaFolders) {
    batch.set(doc(db, COLLECTIONS.mediaFolders, folder.id), folder.data);
  }

  await batch.commit();
  return true;
}

/**
 * Client-side profile bootstrap fallback for local dev when Admin SDK is unavailable.
 * @deprecated Prefer POST /api/auth/ensure-profile in production.
 */
export async function ensureUserProfileClientFallback(db, user) {
  const userRef = doc(db, COLLECTIONS.users, user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const usersSnap = await getDocs(collection(db, COLLECTIONS.users));
    const isFirstUser = usersSnap.empty;

    if (!isFirstUser) {
      throw new Error("This site is closed to new signups. Contact your administrator.");
    }

    await setDoc(userRef, buildUserProfileData(user, "admin", { isFounder: true }));
    await ensureSiteBootstrapped(db);
  }
}
