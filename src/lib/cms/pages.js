import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizeButtonsConfig } from "@/lib/buttons/schema";
import { normalizeDocumentsConfig } from "@/lib/documents/schema";
import { getDefaultConfig } from "@/lib/modules/defaults";
import {
  buildRegionsForColumnCount,
  canReduceColumns,
  getDropValidationError,
  insertModuleAt,
  moveModule,
  normalizePageRegions,
} from "@/lib/pages/regions";
import { generateId } from "@/lib/sitemap/tree";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

export async function listPagesAdmin() {
  const snap = await getDb().collection(COLLECTIONS.pages).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPageAdmin({ pageId, slug }) {
  const db = getDb();
  if (pageId) {
    const snap = await db.collection(COLLECTIONS.pages).doc(pageId).get();
    if (!snap.exists) throw new Error("Page not found");
    return { id: snap.id, ...normalizePageRegions(snap.data()) };
  }
  if (slug !== undefined) {
    const snap = await db.collection(COLLECTIONS.pages).where("slug", "==", slug).limit(1).get();
    if (snap.empty) throw new Error("Page not found");
    const doc = snap.docs[0];
    return { id: doc.id, ...normalizePageRegions(doc.data()) };
  }
  throw new Error("pageId or slug required");
}

export async function updatePageAdmin(pageId, updates) {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.pages).doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Page not found");

  if (updates.contentColumns !== undefined) {
    const check = canReduceColumns(snap.data(), updates.contentColumns);
    if (!check.ok) throw new Error(check.error);
    if (updates.regions === undefined) {
      updates.regions = buildRegionsForColumnCount(snap.data(), updates.contentColumns);
    }
  }

  await ref.update({ ...updates, updatedAt: now() });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

export async function addModuleAdmin(pageId, { type, region = "content-1", insertIndex }) {
  const page = await getPageAdmin({ pageId });
  const error = getDropValidationError(type, region, page);
  if (error) throw new Error(error);

  const mod = {
    id: generateId(),
    type,
    region,
    order: insertIndex ?? 0,
    config: getDefaultConfig(type),
  };
  const regions = insertModuleAt(page.regions || [], region, mod, insertIndex);
  return updatePageAdmin(pageId, { regions });
}

export async function updateModuleAdmin(pageId, moduleId, config) {
  const page = await getPageAdmin({ pageId });
  const regions = (page.regions || []).map((r) => ({
    ...r,
    modules: (r.modules || []).map((m) => {
      if (m.id !== moduleId) return m;
      const merged = { ...m.config, ...config };
      let normalized = merged;
      if (m.type === "documents") {
        normalized = normalizeDocumentsConfig(merged, { filterEmpty: true });
      } else if (m.type === "buttons") {
        normalized = normalizeButtonsConfig(merged, { filterEmpty: true });
      }
      return { ...m, config: normalized };
    }),
  }));
  return updatePageAdmin(pageId, { regions });
}

export async function moveModuleAdmin(pageId, { moduleId, toRegionId, insertIndex }) {
  const page = await getPageAdmin({ pageId });
  const mod = (page.regions || []).flatMap((r) => r.modules || []).find((m) => m.id === moduleId);
  if (!mod) throw new Error("Module not found");

  const error = getDropValidationError(mod.type, toRegionId, page, { excludeModuleId: moduleId });
  if (error) throw new Error(error);

  const regions = moveModule(page.regions || [], moduleId, toRegionId, insertIndex);
  return updatePageAdmin(pageId, { regions });
}

export async function removeModuleAdmin(pageId, moduleId) {
  const page = await getPageAdmin({ pageId });
  const regions = (page.regions || []).map((r) => ({
    ...r,
    modules: (r.modules || []).filter((m) => m.id !== moduleId).map((m, i) => ({ ...m, order: i })),
  }));
  return updatePageAdmin(pageId, { regions });
}

function buildPublishedSnapshot(data) {
  const snapshot = {
    regions: data.regions,
    layout: data.layout,
    title: data.title,
    seo: data.seo,
  };
  if (data.contentMarginX !== undefined) {
    snapshot.contentMarginX = data.contentMarginX;
  }
  return snapshot;
}

export async function publishPageAdmin(pageId) {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.pages).doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Page not found");

  const data = snap.data();
  const ts = now();
  await ref.update({
    status: "published",
    publishedSnapshot: buildPublishedSnapshot(data),
    publishedAt: ts,
    scheduledPublishAt: null,
    updatedAt: ts,
  });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

export async function revertPageAdmin(pageId) {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.pages).doc(pageId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Page not found");

  const data = snap.data();
  if (!data.publishedSnapshot) throw new Error("No published snapshot to revert to");

  await ref.update({
    regions: data.publishedSnapshot.regions,
    layout: data.publishedSnapshot.layout,
    contentMarginX: data.publishedSnapshot.contentMarginX,
    title: data.publishedSnapshot.title,
    seo: data.publishedSnapshot.seo,
    updatedAt: now(),
  });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}
