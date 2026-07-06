import "server-only";

import { revalidatePublicSite } from "@/lib/cache/revalidate-public";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { serializeNavNode } from "@/lib/firestore/serialize";
import {
  buildNavPageNode,
  buildNavTree,
  collectDescendantNodeIds,
  ensureHomeNavInList,
  flattenNavTree,
  isHomeNode,
  syncPageSlugs,
} from "@/lib/sitemap/tree";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

export async function listNavNodesAdmin() {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.navNodes).get();
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

export async function getNavTreeAdmin() {
  const nodes = await listNavNodesAdmin();
  return buildNavTree(nodes);
}

export async function saveSitemapAdmin(flatNodes, existingNodeIds = [], existingPageIds = []) {
  const db = getDb();
  const { pageUpdates } = syncPageSlugs(flatNodes);
  const batch = db.batch();
  const existingIds = new Set(existingNodeIds);
  const knownPageIds = new Set(existingPageIds.filter(Boolean));
  const newIds = new Set(flatNodes.map((n) => n.id));
  const timestamp = now();

  for (const id of existingIds) {
    if (!newIds.has(id)) {
      batch.delete(db.collection(COLLECTIONS.navNodes).doc(id));
    }
  }

  for (const node of flatNodes) {
    batch.set(
      db.collection(COLLECTIONS.navNodes).doc(node.id),
      serializeNavNode(node),
      { merge: true },
    );
  }

  for (const [pageId, { slug, title }] of pageUpdates) {
    const pageRef = db.collection(COLLECTIONS.pages).doc(pageId);
    if (knownPageIds.has(pageId)) {
      batch.set(
        pageRef,
        { slug, title, seo: { title }, updatedAt: timestamp },
        { merge: true },
      );
    } else {
      batch.set(
        pageRef,
        {
          slug,
          title,
          status: "draft",
          layout: "default",
          regions: [{ id: "main", modules: [] }],
          seo: { title },
          updatedAt: timestamp,
        },
        { merge: true },
      );
    }
  }

  await batch.commit();
  revalidatePublicSite();
  return listNavNodesAdmin();
}

export async function saveSitemapFromTreeAdmin(tree) {
  const existing = await listNavNodesAdmin();
  const flat = flattenNavTree(tree);
  return saveSitemapAdmin(
    flat,
    existing.map((n) => n.id),
    existing.map((n) => n.pageId),
  );
}

/**
 * @param {{ title: string, slug?: string, parentId?: string|null, type?: string, isQuickLink?: boolean }} input
 */
export async function addNavPageAdmin(input) {
  const title = input.title?.trim();
  if (!title) throw new Error("title is required");

  const existing = await listNavNodesAdmin();
  const node = buildNavPageNode({
    title,
    slug: input.slug?.trim(),
    parentId: input.parentId ?? null,
    type: input.type ?? "page",
    isQuickLink: input.isQuickLink ?? false,
    existingNodes: existing,
  });

  const nodes = [...existing, node];
  await saveSitemapAdmin(
    nodes,
    existing.map((n) => n.id),
    existing.map((n) => n.pageId),
  );

  return { navNode: node, pageId: node.pageId };
}

export async function deleteNavNodeAdmin(nodeId) {
  const id = nodeId?.trim();
  if (!id) throw new Error("nodeId is required");

  const existing = await listNavNodesAdmin();
  if (!existing.some((n) => n.id === id)) {
    throw new Error("Nav node not found");
  }

  const toRemove = collectDescendantNodeIds(existing, id);
  const nodes = existing.filter((n) => !toRemove.has(n.id));

  await saveSitemapAdmin(
    nodes,
    existing.map((n) => n.id),
    existing.map((n) => n.pageId),
  );

  return { deleted: [...toRemove] };
}
