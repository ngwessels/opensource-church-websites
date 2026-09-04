import { createHash, randomBytes } from "node:crypto";

import {
  ALLOWED_FOLDER_IDS,
  MAX_MEDIA_UPLOAD_BYTES,
} from "./upload-link-constants.js";

export {
  ALLOWED_FOLDER_IDS,
  MAX_MEDIA_UPLOAD_BYTES,
  UPLOAD_LINK_TTL_MS,
} from "./upload-link-constants.js";

/**
 * @returns {string}
 */
export function generateUploadToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * @param {string} token
 * @returns {string}
 */
export function hashUploadToken(token) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("upload token is required");
  }
  return createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * @param {string} baseUrl
 * @param {string} token
 */
export function buildUploadUrl(baseUrl, token) {
  const origin = String(baseUrl || "").replace(/\/+$/, "");
  return `${origin}/mcp-upload/${token}`;
}

/**
 * @param {string | null | undefined} filename
 */
export function sanitizeUploadFilename(filename) {
  const raw = typeof filename === "string" ? filename : "";
  const base = raw.split(/[/\\]/).pop() || "";
  const cleaned = base.replace(/[^\w.\- ()]/g, "_").trim().slice(0, 180);
  return cleaned || "upload";
}

/**
 * @param {string | null | undefined} folderId
 */
export function assertAllowedFolderId(folderId) {
  if (!ALLOWED_FOLDER_IDS.includes(folderId)) {
    throw new Error(
      `folderId must be one of: ${ALLOWED_FOLDER_IDS.join(", ")}`,
    );
  }
  return folderId;
}

/**
 * @param {object | null | undefined} session
 * @param {number} [nowMs]
 * @returns {"not_found" | "complete" | "error" | "expired" | "uploading" | "waiting"}
 */
export function resolveUploadLinkStatus(session, nowMs = Date.now()) {
  if (!session) return "not_found";
  if (session.status === "complete") return "complete";
  if (session.status === "error") return "error";
  const expiresAt = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt < nowMs) return "expired";
  if (session.status === "uploading") return "uploading";
  return "waiting";
}

/**
 * Public payload for MCP tools and the upload page/API.
 *
 * @param {{
 *   token?: string,
 *   baseUrl?: string,
 *   session?: object | null,
 *   nowMs?: number,
 * }} input
 */
export function publicUploadLinkView({ token, baseUrl, session, nowMs = Date.now() }) {
  const status = resolveUploadLinkStatus(session, nowMs);
  const uploadUrl = token && baseUrl ? buildUploadUrl(baseUrl, token) : undefined;

  /** @type {Record<string, unknown>} */
  const view = {
    status,
    uploadUrl,
    expiresAt: session?.expiresAt,
    folderId: session?.folderId,
    filenameHint: session?.filenameHint || "",
    mimeTypeHint: session?.mimeTypeHint || "",
    purpose: session?.purpose || "",
    maxFileBytes: session?.maxFileBytes || MAX_MEDIA_UPLOAD_BYTES,
  };

  if (status === "complete") {
    const media = session?.media && typeof session.media === "object" ? session.media : null;
    view.mediaId = session?.mediaId || media?.id || null;
    view.media = media;
    view.uploadVerified = true;
    if (media) {
      view.sizeBytes = media.sizeBytes;
      view.filename = media.name;
      view.downloadUrl = media.downloadUrl;
    }
  } else if (status === "expired") {
    view.message = "This upload link has expired. Call create_media_upload_link for a new URL.";
    view.uploadVerified = false;
  } else if (status === "error") {
    view.message = session?.errorMessage || "Upload failed.";
    view.uploadVerified = false;
  } else if (status === "not_found") {
    view.message = "Upload link not found.";
    view.uploadVerified = false;
  } else if (status === "uploading") {
    view.message = "A file upload is in progress. Wait, then call get_media_upload again.";
    view.uploadVerified = false;
  } else {
    view.message =
      "Open uploadUrl in a browser. Choose a file and click Upload. Then call get_media_upload with this uploadId.";
    view.uploadVerified = false;
  }

  return view;
}

/**
 * @param {string} folderId
 */
export function defaultMimeTypeHint(folderId) {
  if (folderId === "documents-root") return "application/pdf";
  return "image/*,application/pdf";
}
