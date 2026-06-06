import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

export async function getSiteConfigServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  const snap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  return snap.exists ? snap.data() : null;
}

export async function getNavNodesServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) return [];
  const snap = await db.collection(COLLECTIONS.navNodes).orderBy("order").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPageBySlugServer(slug) {
  const db = getFirebaseAdminFirestore();
  if (!db) return null;
  const normalized = slug || "";
  const snap = await db
    .collection(COLLECTIONS.pages)
    .where("slug", "==", normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function getPublishedPagesServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) return [];
  const snap = await db.collection(COLLECTIONS.pages).where("status", "==", "published").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listBulletinsServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) return [];
  const snap = await db.collection(COLLECTIONS.bulletins).orderBy("date", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
