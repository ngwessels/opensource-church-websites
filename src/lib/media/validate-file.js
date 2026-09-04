/**
 * Validate uploaded file bytes against the declared type / filename.
 *
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
      throw new Error("File is not a valid PDF (missing %PDF header).");
    }
    return;
  }

  if (isPng) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(sig)) {
      throw new Error("File is not a valid PNG.");
    }
    return;
  }

  if (isJpeg) {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new Error("File is not a valid JPEG.");
    }
    return;
  }

  if (isGif) {
    const head = buffer.subarray(0, 6).toString("latin1");
    if (head !== "GIF87a" && head !== "GIF89a") {
      throw new Error("File is not a valid GIF.");
    }
    return;
  }

  if (isWebp) {
    if (
      buffer.length < 12 ||
      buffer.subarray(0, 4).toString("latin1") !== "RIFF" ||
      buffer.subarray(8, 12).toString("latin1") !== "WEBP"
    ) {
      throw new Error("File is not a valid WebP.");
    }
    return;
  }

  if (isIco) {
    if (buffer.length < 4 || buffer[0] !== 0x00 || buffer[1] !== 0x00 || buffer[2] !== 0x01 || buffer[3] !== 0x00) {
      throw new Error("File is not a valid ICO.");
    }
  }
}
