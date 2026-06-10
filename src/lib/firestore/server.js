import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { ensureHomeNavInList, isHomeNode } from "@/lib/sitemap/tree";

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
  let nodes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!nodes.some((n) => isHomeNode(n))) {
    const homeSnap = await db.collection(COLLECTIONS.pages).where("slug", "==", "").limit(1).get();
    if (!homeSnap.empty) {
      nodes = ensureHomeNavInList(nodes, homeSnap.docs[0].id);
    }
  } else {
    nodes = ensureHomeNavInList(nodes, null);
  }

  return nodes;
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
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((page) => page.hidden !== true);
}

export async function getHiddenPagesServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) return { pageIds: new Set(), slugs: new Set() };

  const snap = await db.collection(COLLECTIONS.pages).where("hidden", "==", true).get();
  const pageIds = new Set();
  const slugs = new Set();
  for (const doc of snap.docs) {
    pageIds.add(doc.id);
    const slug = doc.data().slug;
    if (slug !== undefined && slug !== null) {
      slugs.add(slug);
    }
  }
  return { pageIds, slugs };
}

export async function listBulletinsServer() {
  const db = getFirebaseAdminFirestore();
  if (!db) return [];
  const snap = await db.collection(COLLECTIONS.bulletins).orderBy("date", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
