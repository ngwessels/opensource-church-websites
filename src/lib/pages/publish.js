import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";

import { COLLECTIONS } from "@/lib/firestore/paths";

function buildPublishedSnapshot(data) {
  return {
    regions: data.regions,
    layout: data.layout,
    contentMarginX: data.contentMarginX,
    title: data.title,
    seo: data.seo,
  };
}

export async function publishPage(db, pageId) {
  const pageRef = doc(db, COLLECTIONS.pages, pageId);
  const snap = await getDoc(pageRef);
  if (!snap.exists()) throw new Error("Page not found");

  const data = snap.data();
  const now = new Date().toISOString();

  await updateDoc(pageRef, {
    status: "published",
    publishedSnapshot: buildPublishedSnapshot(data),
    publishedAt: now,
    scheduledPublishAt: deleteField(),
    updatedAt: now,
  });
}

export async function revertPageDraft(db, pageId) {
  const pageRef = doc(db, COLLECTIONS.pages, pageId);
  const snap = await getDoc(pageRef);
  if (!snap.exists()) throw new Error("Page not found");

  const data = snap.data();
  if (!data.publishedSnapshot) return;

  await updateDoc(pageRef, {
    regions: data.publishedSnapshot.regions,
    layout: data.publishedSnapshot.layout,
    contentMarginX: data.publishedSnapshot.contentMarginX,
    title: data.publishedSnapshot.title,
    seo: data.publishedSnapshot.seo,
    updatedAt: new Date().toISOString(),
  });
}
