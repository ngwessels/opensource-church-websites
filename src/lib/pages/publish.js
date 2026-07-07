import { deleteField, doc, getDoc } from "firebase/firestore";

import { auditedUpdateDoc } from "@/lib/firestore/audited-mutation";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizePageRegions } from "@/lib/pages/regions";

function appendLayoutFieldsToSnapshot(snapshot, data) {
  if (data.contentMarginX !== undefined) {
    snapshot.contentMarginX = data.contentMarginX;
  }
  if (data.contentMarginXByViewport !== undefined) {
    snapshot.contentMarginXByViewport = data.contentMarginXByViewport;
  }
  if (data.contentColumnsByViewport !== undefined) {
    snapshot.contentColumnsByViewport = data.contentColumnsByViewport;
  }
  if (data.contentStackOrderByViewport !== undefined) {
    snapshot.contentStackOrderByViewport = data.contentStackOrderByViewport;
  }
  return snapshot;
}

/** Public view of a page: published snapshot when live, otherwise editor state. */
export function resolvePublishedPageView(page) {
  if (!page) return null;

  if (page.status !== "published" || !page.publishedSnapshot) {
    return normalizePageRegions(page);
  }

  const snapshot = page.publishedSnapshot;
  return normalizePageRegions({
    ...page,
    regions: snapshot.regions,
    layout: snapshot.layout ?? page.layout,
    title: snapshot.title ?? page.title,
    seo: snapshot.seo ?? page.seo,
    contentMarginX: snapshot.contentMarginX ?? page.contentMarginX,
    contentMarginXByViewport: snapshot.contentMarginXByViewport ?? page.contentMarginXByViewport,
    contentColumnsByViewport: snapshot.contentColumnsByViewport ?? page.contentColumnsByViewport,
    contentStackOrderByViewport:
      snapshot.contentStackOrderByViewport ?? page.contentStackOrderByViewport,
  });
}

export function buildPublishedSnapshot(data) {
  const snapshot = {
    regions: data.regions,
    layout: data.layout,
    title: data.title,
    seo: data.seo,
  };
  return appendLayoutFieldsToSnapshot(snapshot, data);
}

/** Normalized publish payload for comparing draft vs published state. */
export function getPagePublishSnapshot(page) {
  if (!page) return null;
  return buildPublishedSnapshot(normalizePageRegions(page));
}

function canonicalize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function snapshotsEqual(a, b) {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function snapshotFromPublishedRecord(page, publishedSnapshot) {
  return getPagePublishSnapshot({
    ...page,
    regions: publishedSnapshot.regions,
    layout: publishedSnapshot.layout ?? page.layout,
    title: publishedSnapshot.title ?? page.title,
    seo: publishedSnapshot.seo ?? page.seo,
    contentMarginX: publishedSnapshot.contentMarginX,
    contentMarginXByViewport: publishedSnapshot.contentMarginXByViewport,
    contentColumnsByViewport: publishedSnapshot.contentColumnsByViewport,
    contentStackOrderByViewport: publishedSnapshot.contentStackOrderByViewport,
  });
}

/**
 * True when draft content differs from the last published snapshot.
 */
export function pageDiffersFromPublished(page) {
  if (!page?.publishedSnapshot) return false;
  const current = getPagePublishSnapshot(page);
  const published = snapshotFromPublishedRecord(page, page.publishedSnapshot);
  return !snapshotsEqual(current, published);
}

/**
 * True when the Publish action would change what is live.
 * Uses the load baseline so the button stays off until the editor makes changes.
 */
export function pageHasUnpublishedChanges(page, { baselineSnapshot } = {}) {
  if (!page) return false;

  const current = getPagePublishSnapshot(page);
  if (!current) return false;

  if (page.status === "draft" && !page.publishedAt && !page.publishedSnapshot) {
    return true;
  }

  if (!baselineSnapshot) return false;
  return !snapshotsEqual(current, baselineSnapshot);
}

export async function publishPage(db, pageId, audit) {
  const pageRef = doc(db, COLLECTIONS.pages, pageId);
  const snap = await getDoc(pageRef);
  if (!snap.exists()) throw new Error("Page not found");

  const data = snap.data();
  const now = new Date().toISOString();
  const updates = {
    status: "published",
    publishedSnapshot: buildPublishedSnapshot(normalizePageRegions(data)),
    publishedAt: now,
    scheduledPublishAt: deleteField(),
    updatedAt: now,
  };

  if (audit) {
    await auditedUpdateDoc(pageRef, updates, audit);
    return;
  }

  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(pageRef, updates);
}

export async function revertPageDraft(db, pageId, audit) {
  const pageRef = doc(db, COLLECTIONS.pages, pageId);
  const snap = await getDoc(pageRef);
  if (!snap.exists()) throw new Error("Page not found");

  const data = snap.data();
  if (!data.publishedSnapshot) return;

  const updates = {
    regions: data.publishedSnapshot.regions,
    layout: data.publishedSnapshot.layout,
    contentMarginX: data.publishedSnapshot.contentMarginX,
    contentMarginXByViewport: data.publishedSnapshot.contentMarginXByViewport,
    contentColumnsByViewport: data.publishedSnapshot.contentColumnsByViewport,
    contentStackOrderByViewport: data.publishedSnapshot.contentStackOrderByViewport,
    title: data.publishedSnapshot.title,
    seo: data.publishedSnapshot.seo,
    updatedAt: new Date().toISOString(),
  };

  if (audit) {
    await auditedUpdateDoc(pageRef, updates, audit);
    return;
  }

  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(pageRef, updates);
}
