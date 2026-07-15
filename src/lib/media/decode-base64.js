/**
 * Decode and validate base64 media payloads for MCP / admin uploads.
 *
 * Two separate failure modes matter here:
 * 1. Cursor/LLM tool calls often truncate large base64 strings → corrupt short files
 * 2. Vercel serverless request bodies are capped at ~4.5 MB → oversize calls 413
 *
 * Limits below leave headroom for the JSON-RPC MCP envelope around the base64 field.
 */

export const MIN_DECODED_BYTES = 32;

/** Vercel Functions request body limit (bytes). */
export const VERCEL_BODY_LIMIT_BYTES = Math.floor(4.5 * 1024 * 1024);

/**
 * Max decoded size for a single-shot `upload_media` base64 field.
 * ~1 MiB binary ≈ 1.33 MiB base64 — safely under the 4.5 MB body limit with envelope.
 */
export const MAX_SINGLE_SHOT_BYTES = 1 * 1024 * 1024;

/**
 * Hard cap per chunk base64 string. ~350 KiB chars ≈ 260 KiB binary.
 * Keeps each MCP POST well under Vercel's 4.5 MB limit.
 */
export const MAX_CHUNK_BASE64_CHARS = 350_000;

/**
 * Recommended binary chunk size (~96 KiB → ~128 KiB base64).
 * Small enough for Vercel body limits and for MCP clients that truncate large args.
 */
export const RECOMMENDED_CHUNK_BYTES = 96 * 1024;

/** Max assembled file size for chunked MCP uploads (each request stays small). */
export const MAX_CHUNKED_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Max file size when the server fetches `sourceUrl` (not limited by request body). */
export const MAX_SOURCE_URL_BYTES = 10 * 1024 * 1024;

/**
 * @param {string} input
 * @returns {{ base64: string, mimeFromUri: string | null }}
 */
export function normalizeBase64Payload(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("base64 is required and must be a non-empty string");
  }

  let raw = input.trim();
  const dataUriMatch = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/is.exec(raw);
  if (dataUriMatch) {
    return {
      mimeFromUri: dataUriMatch[1] ? dataUriMatch[1].trim().toLowerCase() : null,
      base64: dataUriMatch[2].replace(/\s/g, ""),
    };
  }

  // Common agent mistake: pass the data-URI prefix without stripping.
  const commaIdx = raw.indexOf("base64,");
  if (/^data:/i.test(raw) && commaIdx !== -1) {
    const mimePart = raw.slice(5, commaIdx).split(";")[0].trim();
    return {
      mimeFromUri: mimePart || null,
      base64: raw.slice(commaIdx + "base64,".length).replace(/\s/g, ""),
    };
  }

  return { mimeFromUri: null, base64: raw.replace(/\s/g, "") };
}

/**
 * @param {Buffer} buffer
 * @param {string | null | undefined} mimeType
 * @param {string | null | undefined} filename
 */
export function validateMagicBytes(buffer, mimeType, filename) {
  const name = typeof filename === "string" ? filename.toLowerCase() : "";
  const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : "";

  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  const isPng = mime === "image/png" || name.endsWith(".png");
  const isJpeg =
    mime === "image/jpeg" || mime === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg");
  const isGif = mime === "image/gif" || name.endsWith(".gif");
  const isWebp = mime === "image/webp" || name.endsWith(".webp");
  const isIco = mime === "image/x-icon" || mime === "image/vnd.microsoft.icon" || name.endsWith(".ico");

  if (isPdf) {
    if (buffer.length < 5 || buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
      throw new Error(
        "Decoded bytes are not a valid PDF (missing %PDF header). The base64 payload was likely truncated or invented.",
      );
    }
    return;
  }

  if (isPng) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(sig)) {
      throw new Error(
        "Decoded bytes are not a valid PNG. The base64 payload was likely truncated or invented.",
      );
    }
    return;
  }

  if (isJpeg) {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new Error(
        "Decoded bytes are not a valid JPEG. The base64 payload was likely truncated or invented.",
      );
    }
    return;
  }

  if (isGif) {
    const head = buffer.subarray(0, 6).toString("latin1");
    if (head !== "GIF87a" && head !== "GIF89a") {
      throw new Error(
        "Decoded bytes are not a valid GIF. The base64 payload was likely truncated or invented.",
      );
    }
    return;
  }

  if (isWebp) {
    if (
      buffer.length < 12 ||
      buffer.subarray(0, 4).toString("latin1") !== "RIFF" ||
      buffer.subarray(8, 12).toString("latin1") !== "WEBP"
    ) {
      throw new Error(
        "Decoded bytes are not a valid WebP. The base64 payload was likely truncated or invented.",
      );
    }
    return;
  }

  if (isIco) {
    if (buffer.length < 4 || buffer[0] !== 0x00 || buffer[1] !== 0x00 || buffer[2] !== 0x01 || buffer[3] !== 0x00) {
      throw new Error(
        "Decoded bytes are not a valid ICO. The base64 payload was likely truncated or invented.",
      );
    }
  }
}

/**
 * @param {string} input
 * @param {{ filename?: string, mimeType?: string, expectedSizeBytes?: number, minBytes?: number, maxBytes?: number }} [options]
 * @returns {{ buffer: Buffer, mimeType: string }}
 */
export function decodeBase64Media(input, options = {}) {
  const {
    filename,
    mimeType,
    expectedSizeBytes,
    minBytes = MIN_DECODED_BYTES,
    maxBytes = MAX_SINGLE_SHOT_BYTES,
  } = options;
  const { base64, mimeFromUri } = normalizeBase64Payload(input);
  const resolvedMime = mimeType || mimeFromUri || "application/octet-stream";

  const maxBase64Chars = Math.ceil((maxBytes * 4) / 3) + 8;
  if (base64.length > maxBase64Chars) {
    throw new Error(
      `base64 payload is too large for one request (decoded limit ${Math.round(maxBytes / 1024)} KB). ` +
        `Vercel MCP request bodies are capped at ~4.5 MB. Use begin_media_upload / upload_media_chunk ` +
        `(~${Math.round(RECOMMENDED_CHUNK_BYTES / 1024)} KB chunks) or sourceUrl.`,
    );
  }

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error("base64 payload contains invalid characters");
  }

  const buffer = Buffer.from(base64, "base64");

  if (buffer.length === 0) {
    throw new Error("Decoded file is empty — base64 was missing or invalid");
  }

  if (buffer.length < minBytes) {
    throw new Error(
      `Decoded file is only ${buffer.length} bytes (minimum ${minBytes}). ` +
        "The base64 payload was likely truncated in the tool call. " +
        "Use begin_media_upload / upload_media_chunk / complete_media_upload, or sourceUrl.",
    );
  }

  if (buffer.length > maxBytes) {
    throw new Error(
      `Decoded file is ${buffer.length} bytes; max for this request is ${maxBytes} bytes. ` +
        `Vercel request bodies are limited to ~4.5 MB. Prefer sourceUrl or chunked upload.`,
    );
  }

  if (expectedSizeBytes != null) {
    const expected = Number(expectedSizeBytes);
    if (!Number.isFinite(expected) || expected < 1 || !Number.isInteger(expected)) {
      throw new Error("expectedSizeBytes must be a positive integer");
    }
    if (buffer.length !== expected) {
      throw new Error(
        `Size mismatch: decoded ${buffer.length} bytes but expectedSizeBytes was ${expected}. ` +
          "The base64 payload was truncated or incomplete. " +
          "Prefer chunked upload (begin_media_upload → upload_media_chunk → complete_media_upload) or sourceUrl.",
      );
    }
  }

  validateMagicBytes(buffer, resolvedMime, filename);

  return { buffer, mimeType: resolvedMime };
}
