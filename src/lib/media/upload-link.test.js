import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAllowedFolderId,
  buildUploadUrl,
  generateUploadToken,
  hashUploadToken,
  publicUploadLinkView,
  resolveUploadLinkStatus,
  sanitizeUploadFilename,
} from "./upload-link.js";

describe("upload link tokens", () => {
  it("hashes a token to a stable 64-char hex digest", () => {
    const token = generateUploadToken();
    const hash = hashUploadToken(token);
    assert.equal(hash.length, 64);
    assert.match(hash, /^[a-f0-9]+$/);
    assert.equal(hashUploadToken(token), hash);
    assert.notEqual(hashUploadToken(generateUploadToken()), hash);
  });

  it("rejects an empty token", () => {
    assert.throws(() => hashUploadToken(""), /required/);
  });
});

describe("resolveUploadLinkStatus", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  it("returns not_found without a session", () => {
    assert.equal(resolveUploadLinkStatus(null), "not_found");
  });

  it("returns waiting for an open unexpired session", () => {
    assert.equal(resolveUploadLinkStatus({ status: "waiting", expiresAt: future }), "waiting");
  });

  it("returns complete even if the expiry has passed", () => {
    assert.equal(
      resolveUploadLinkStatus({ status: "complete", expiresAt: past, mediaId: "media_1" }),
      "complete",
    );
  });

  it("returns expired for a waiting session past expiresAt", () => {
    assert.equal(resolveUploadLinkStatus({ status: "waiting", expiresAt: past }), "expired");
  });

  it("returns uploading for an in-progress unexpired session", () => {
    assert.equal(resolveUploadLinkStatus({ status: "uploading", expiresAt: future }), "uploading");
  });

  it("returns error when the session is marked error", () => {
    assert.equal(resolveUploadLinkStatus({ status: "error", expiresAt: future }), "error");
  });
});

describe("publicUploadLinkView", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const token = "abcToken";
  const baseUrl = "https://parish.example.org/";

  it("includes uploadUrl without a trailing slash on the origin", () => {
    const view = publicUploadLinkView({
      token,
      baseUrl,
      session: { status: "waiting", expiresAt: future, folderId: "documents-root" },
    });
    assert.equal(view.uploadUrl, "https://parish.example.org/mcp-upload/abcToken");
    assert.equal(view.status, "waiting");
    assert.equal(view.uploadVerified, false);
  });

  it("includes media details when complete", () => {
    const media = {
      id: "media_1",
      name: "bulletin.pdf",
      downloadUrl: "https://example/file",
      sizeBytes: 1200,
      mimeType: "application/pdf",
      folderId: "documents-root",
    };
    const view = publicUploadLinkView({
      token,
      baseUrl: "https://parish.example.org",
      session: { status: "complete", expiresAt: future, mediaId: "media_1", media },
    });
    assert.equal(view.status, "complete");
    assert.equal(view.uploadVerified, true);
    assert.equal(view.mediaId, "media_1");
    assert.equal(view.downloadUrl, media.downloadUrl);
    assert.equal(view.sizeBytes, 1200);
    assert.deepEqual(view.media, media);
  });

  it("does not treat a completed link as reusable", () => {
    const view = publicUploadLinkView({
      token,
      baseUrl: "https://parish.example.org",
      session: { status: "complete", expiresAt: future, mediaId: "media_1", media: { id: "media_1" } },
    });
    assert.equal(view.status, "complete");
    assert.notEqual(view.status, "waiting");
  });
});

describe("sanitizeUploadFilename", () => {
  it("strips path segments and unsafe characters", () => {
    assert.equal(sanitizeUploadFilename("../../etc/passwd"), "passwd");
    assert.equal(sanitizeUploadFilename("Sunday Bulletin (1).pdf"), "Sunday Bulletin (1).pdf");
    assert.equal(sanitizeUploadFilename(""), "upload");
  });
});

describe("assertAllowedFolderId", () => {
  it("accepts known folders and rejects others", () => {
    assert.equal(assertAllowedFolderId("documents-root"), "documents-root");
    assert.throws(() => assertAllowedFolderId("secret"), /folderId must be one of/);
  });
});

describe("buildUploadUrl", () => {
  it("joins origin and token", () => {
    assert.equal(buildUploadUrl("https://a.example", "tok"), "https://a.example/mcp-upload/tok");
  });
});
