import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { ADMIN_DOCUMENTATION_ID, COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { listBulletinsServer } from "@/lib/firestore/server";
import { normalizePageRegions } from "@/lib/pages/regions";

export { searchInSiteData } from "@/lib/cms/content-search-core";

import { searchInSiteData } from "@/lib/cms/content-search-core";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

/**
 * @param {{ query: string, limit?: number }} input
 */
export async function searchSiteContentAdmin({ query, limit = 50 }) {
  const q = String(query || "").trim();
  if (!q) throw new Error("query is required");

  const db = getDb();
  const [pagesSnap, configSnap, navSnap, bulletins, mediaSnap, adminDocsSnap] = await Promise.all([
    db.collection(COLLECTIONS.pages).get(),
    db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get(),
    db.collection(COLLECTIONS.navNodes).get(),
    listBulletinsServer(),
    db.collection(COLLECTIONS.media).get(),
    db.collection(COLLECTIONS.site).doc(ADMIN_DOCUMENTATION_ID).get(),
  ]);

  const pages = pagesSnap.docs.map((doc) => ({
    id: doc.id,
    ...normalizePageRegions(doc.data()),
  }));
  const siteConfig = configSnap.exists ? configSnap.data() : {};
  const navNodes = navSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const media = mediaSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const adminDocumentation = adminDocsSnap.exists ? adminDocsSnap.data() : {};

  return searchInSiteData({
    query: q,
    pages,
    siteConfig,
    navNodes,
    bulletins,
    media,
    adminDocumentation,
    limit,
  });
}
