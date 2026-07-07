import "server-only";

import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";

import {
  SITE_EXPORT_COLLECTIONS,
  SITE_EXPORT_EXCLUDED,
  SITE_EXPORT_STORAGE_PREFIXES,
  buildExportManifest,
  sanitizeUserExport,
  serializeExportJson,
} from "@/lib/export/site-export-format";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getFirebaseAdminStorage } from "@/lib/firebase/admin-storage";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

export {
  SITE_EXPORT_COLLECTIONS,
  SITE_EXPORT_EXCLUDED,
  SITE_EXPORT_STORAGE_PREFIXES,
  SITE_EXPORT_VERSION,
  buildExportManifest,
  getSiteExportFilename,
  sanitizeUserExport,
  serializeExportJson,
} from "@/lib/export/site-export-format";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function readSiteConfig(db) {
  const snap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} collectionName
 * @param {(doc: Record<string, unknown> & { id: string }) => Record<string, unknown>} [mapDoc]
 */
async function readCollection(db, collectionName, mapDoc) {
  const snap = await db.collection(collectionName).get();
  return snap.docs.map((docSnap) => {
    const base = { id: docSnap.id, ...docSnap.data() };
    return mapDoc ? mapDoc(base) : base;
  });
}

/**
 * @returns {Promise<import("firebase-admin/firestore").Firestore>}
 */
function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

/**
 * @returns {import("@google-cloud/storage").Bucket}
 */
function getBucket() {
  const storage = getFirebaseAdminStorage();
  if (!storage) throw new Error("Firebase Admin Storage is not configured");
  return storage.bucket();
}

/**
 * @param {import("@google-cloud/storage").File[]} files
 */
function summarizeStorageFiles(files) {
  let totalBytes = 0;
  for (const file of files) {
    const size = Number(file.metadata?.size || 0);
    totalBytes += Number.isFinite(size) ? size : 0;
  }
  return {
    fileCount: files.length,
    totalBytes,
  };
}

/**
 * @param {import("@google-cloud/storage").Bucket} bucket
 */
async function listStorageFiles(bucket) {
  const results = await Promise.all(
    SITE_EXPORT_STORAGE_PREFIXES.map((prefix) => bucket.getFiles({ prefix })),
  );
  return results.flatMap(([files]) => files);
}

/**
 * @param {object} [options]
 * @param {string} [options.siteName]
 */
export async function loadSiteExportData({ siteName = "" } = {}) {
  const db = getDb();
  const bucket = getBucket();

  const [
    siteConfig,
    pages,
    navNodes,
    media,
    mediaFolders,
    bulletins,
    donations,
    formSubmissions,
    users,
    storageFiles,
  ] = await Promise.all([
    readSiteConfig(db),
    readCollection(db, COLLECTIONS.pages),
    readCollection(db, COLLECTIONS.navNodes),
    readCollection(db, COLLECTIONS.media),
    readCollection(db, COLLECTIONS.mediaFolders),
    readCollection(db, COLLECTIONS.bulletins),
    readCollection(db, COLLECTIONS.donations),
    readCollection(db, COLLECTIONS.formSubmissions),
    readCollection(db, COLLECTIONS.users, sanitizeUserExport),
    listStorageFiles(bucket),
  ]);

  const storage = summarizeStorageFiles(storageFiles);
  const collections = {
    "site-config": siteConfig ? 1 : 0,
    [COLLECTIONS.pages]: pages.length,
    [COLLECTIONS.navNodes]: navNodes.length,
    [COLLECTIONS.media]: media.length,
    [COLLECTIONS.mediaFolders]: mediaFolders.length,
    [COLLECTIONS.bulletins]: bulletins.length,
    [COLLECTIONS.donations]: donations.length,
    [COLLECTIONS.formSubmissions]: formSubmissions.length,
    [COLLECTIONS.users]: users.length,
  };

  const firestoreBytes = Buffer.byteLength(
    serializeExportJson({
      siteConfig,
      pages,
      navNodes,
      media,
      mediaFolders,
      bulletins,
      donations,
      formSubmissions,
      users,
    }),
    "utf8",
  );

  const manifest = buildExportManifest({
    siteName,
    collections,
    storage,
    includedCollections: SITE_EXPORT_COLLECTIONS.map((item) => item.label),
    excludedCollections: SITE_EXPORT_EXCLUDED,
  });

  return {
    siteName,
    siteConfig,
    pages,
    navNodes,
    media,
    mediaFolders,
    bulletins,
    donations,
    formSubmissions,
    users,
    storageFiles,
    collections,
    storage,
    firestoreBytes,
    estimatedBytes: firestoreBytes + storage.totalBytes,
    manifest,
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.siteName]
 */
export async function getSiteExportPreview({ siteName = "" } = {}) {
  const data = await loadSiteExportData({ siteName });
  return {
    siteName: data.siteName,
    collections: data.collections,
    storage: data.storage,
    firestoreBytes: data.firestoreBytes,
    estimatedBytes: data.estimatedBytes,
    includedCollections: SITE_EXPORT_COLLECTIONS.map((item) => ({
      id: item.id,
      label: item.label,
      count: data.collections[item.id] ?? 0,
    })),
    excludedCollections: SITE_EXPORT_EXCLUDED,
    storagePrefixes: SITE_EXPORT_STORAGE_PREFIXES,
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.siteName]
 * @returns {Promise<import("node:stream").Readable>}
 */
export async function buildSiteExportZip({ siteName = "" } = {}) {
  const data = await loadSiteExportData({ siteName });
  const output = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 6 } });

  archive.on("error", (error) => {
    output.destroy(error);
  });

  archive.pipe(output);

  archive.append(serializeExportJson(data.siteConfig), { name: "firestore/site-config.json" });
  archive.append(serializeExportJson(data.pages), { name: "firestore/pages.json" });
  archive.append(serializeExportJson(data.navNodes), { name: "firestore/navNodes.json" });
  archive.append(serializeExportJson(data.media), { name: "firestore/media.json" });
  archive.append(serializeExportJson(data.mediaFolders), { name: "firestore/mediaFolders.json" });
  archive.append(serializeExportJson(data.bulletins), { name: "firestore/bulletins.json" });
  archive.append(serializeExportJson(data.donations), { name: "firestore/donations.json" });
  archive.append(serializeExportJson(data.formSubmissions), { name: "firestore/formSubmissions.json" });
  archive.append(serializeExportJson(data.users), { name: "firestore/users.json" });
  archive.append(serializeExportJson(data.manifest), { name: "manifest.json" });

  for (const file of data.storageFiles) {
    archive.append(file.createReadStream(), { name: `storage/${file.name}` });
  }

  void archive.finalize();
  return output;
}
