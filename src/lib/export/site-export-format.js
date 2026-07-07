import { COLLECTIONS } from "../firestore/paths.js";

/** @typedef {{ id: string, key: string, label: string, kind: "doc" | "collection" }} SiteExportCollectionDef */

export const SITE_EXPORT_VERSION = 1;

export const SITE_EXPORT_STORAGE_PREFIXES = ["media/", "form-uploads/"];

export const SITE_EXPORT_EXCLUDED = [
  { collection: COLLECTIONS.mcpTokenLookup, reason: "MCP token hashes (server infrastructure)" },
  { collection: COLLECTIONS.mcpOAuthClients, reason: "OAuth client registry (server infrastructure)" },
  { collection: COLLECTIONS.mcpOAuthCodes, reason: "Short-lived OAuth codes (server infrastructure)" },
  {
    collection: `${COLLECTIONS.users}/*/mcpConnections`,
    reason: "MCP connection secrets (token hashes)",
  },
];

/** @type {SiteExportCollectionDef[]} */
export const SITE_EXPORT_COLLECTIONS = [
  { id: "site-config", key: "site-config.json", label: "Site configuration", kind: "doc" },
  { id: COLLECTIONS.pages, key: "pages.json", label: "Pages", kind: "collection" },
  { id: COLLECTIONS.navNodes, key: "navNodes.json", label: "Navigation", kind: "collection" },
  { id: COLLECTIONS.media, key: "media.json", label: "Media metadata", kind: "collection" },
  { id: COLLECTIONS.mediaFolders, key: "mediaFolders.json", label: "Media folders", kind: "collection" },
  { id: COLLECTIONS.bulletins, key: "bulletins.json", label: "Bulletins", kind: "collection" },
  { id: COLLECTIONS.donations, key: "donations.json", label: "Donations", kind: "collection" },
  { id: COLLECTIONS.formSubmissions, key: "formSubmissions.json", label: "Form submissions", kind: "collection" },
  { id: COLLECTIONS.users, key: "users.json", label: "Admin users", kind: "collection" },
];

/**
 * @param {Record<string, unknown> & { id?: string }} doc
 */
export function sanitizeUserExport(doc) {
  return {
    id: doc.id,
    email: doc.email ?? "",
    displayName: doc.displayName ?? "",
    role: doc.role ?? "member",
    isFounder: Boolean(doc.isFounder),
    createdAt: doc.createdAt ?? "",
    updatedAt: doc.updatedAt ?? "",
  };
}

/**
 * @param {unknown} data
 * @returns {string}
 */
export function serializeExportJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/**
 * @param {object} options
 * @param {string} [options.siteName]
 * @param {Record<string, number>} options.collections
 * @param {{ fileCount: number, totalBytes: number }} options.storage
 * @param {string[]} options.includedCollections
 * @param {Array<{ collection: string, reason: string }>} options.excludedCollections
 */
export function buildExportManifest({
  siteName = "",
  collections,
  storage,
  includedCollections,
  excludedCollections,
}) {
  return {
    version: SITE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    siteName,
    collections,
    storage,
    includedCollections,
    excludedCollections,
    storagePrefixes: SITE_EXPORT_STORAGE_PREFIXES,
  };
}

/**
 * @returns {string}
 */
export function getSiteExportFilename() {
  return `site-export-${new Date().toISOString().slice(0, 10)}.zip`;
}
