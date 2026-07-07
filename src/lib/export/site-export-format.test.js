import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SITE_EXPORT_COLLECTIONS,
  SITE_EXPORT_EXCLUDED,
  SITE_EXPORT_STORAGE_PREFIXES,
  SITE_EXPORT_VERSION,
  buildExportManifest,
  sanitizeUserExport,
  serializeExportJson,
} from "./site-export-format.js";

describe("site-export", () => {
  it("sanitizeUserExport keeps only safe profile fields", () => {
    const result = sanitizeUserExport({
      id: "user-1",
      email: "admin@example.org",
      displayName: "Admin User",
      role: "admin",
      isFounder: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      tokenHash: "secret",
      mcpConnections: [{ id: "conn-1" }],
    });

    assert.deepEqual(result, {
      id: "user-1",
      email: "admin@example.org",
      displayName: "Admin User",
      role: "admin",
      isFounder: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("serializeExportJson pretty-prints JSON with trailing newline", () => {
    const output = serializeExportJson({ hello: "world" });
    assert.equal(output, '{\n  "hello": "world"\n}\n');
  });

  it("buildExportManifest includes version, counts, and exclusions", () => {
    const manifest = buildExportManifest({
      siteName: "St. Mary Parish",
      collections: {
        "site-config": 1,
        pages: 12,
        navNodes: 8,
        media: 40,
        mediaFolders: 3,
        bulletins: 5,
        donations: 2,
        formSubmissions: 7,
        users: 3,
      },
      storage: { fileCount: 42, totalBytes: 1024 },
      includedCollections: SITE_EXPORT_COLLECTIONS.map((item) => item.label),
      excludedCollections: SITE_EXPORT_EXCLUDED,
    });

    assert.equal(manifest.version, SITE_EXPORT_VERSION);
    assert.equal(manifest.siteName, "St. Mary Parish");
    assert.equal(manifest.collections.pages, 12);
    assert.equal(manifest.storage.fileCount, 42);
    assert.equal(manifest.includedCollections.length, SITE_EXPORT_COLLECTIONS.length);
    assert.equal(manifest.excludedCollections.length, SITE_EXPORT_EXCLUDED.length);
    assert.deepEqual(manifest.storagePrefixes, SITE_EXPORT_STORAGE_PREFIXES);
    assert.match(manifest.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("SITE_EXPORT_COLLECTIONS covers all planned firestore exports", () => {
    const keys = SITE_EXPORT_COLLECTIONS.map((item) => item.key);
    assert.deepEqual(keys, [
      "site-config.json",
      "pages.json",
      "navNodes.json",
      "media.json",
      "mediaFolders.json",
      "bulletins.json",
      "donations.json",
      "formSubmissions.json",
      "users.json",
    ]);
  });
});
