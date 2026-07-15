import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeBase64Media,
  normalizeBase64Payload,
  validateMagicBytes,
} from "./decode-base64.js";

describe("normalizeBase64Payload", () => {
  it("strips data URIs", () => {
    const pdfB64 = Buffer.from("%PDF-1.7\n%âãÏÓ\n").toString("base64");
    const { base64, mimeFromUri } = normalizeBase64Payload(`data:application/pdf;base64,${pdfB64}`);
    assert.equal(mimeFromUri, "application/pdf");
    assert.equal(base64, pdfB64);
  });

  it("removes whitespace from raw base64", () => {
    const { base64 } = normalizeBase64Payload("QUJD\nREVG");
    assert.equal(base64, "QUJDREVG");
  });
});

describe("decodeBase64Media", () => {
  it("rejects the classic truncated PDF stub (7 bytes)", () => {
    assert.throws(
      () =>
        decodeBase64Media("JVBERi0xLg==", {
          filename: "bulletin.pdf",
          mimeType: "application/pdf",
          expectedSizeBytes: 7,
        }),
      /only 7 bytes|truncated|invented/i,
    );
  });

  it("rejects size mismatches from truncated payloads", () => {
    const full = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(5000, 0x41),
      Buffer.from("\n%%EOF\n"),
    ]);
    const truncatedB64 = full.subarray(0, 200).toString("base64");
    assert.throws(
      () =>
        decodeBase64Media(truncatedB64, {
          filename: "doc.pdf",
          mimeType: "application/pdf",
          expectedSizeBytes: full.length,
        }),
      /Size mismatch/,
    );
  });

  it("accepts a complete PDF when size matches", () => {
    const full = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(200, 0x20),
      Buffer.from("\n%%EOF\n"),
    ]);
    const { buffer, mimeType } = decodeBase64Media(full.toString("base64"), {
      filename: "ok.pdf",
      mimeType: "application/pdf",
      expectedSizeBytes: full.length,
    });
    assert.equal(buffer.length, full.length);
    assert.equal(mimeType, "application/pdf");
  });

  it("accepts PNG magic bytes", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 1),
    ]);
    const { buffer } = decodeBase64Media(png.toString("base64"), {
      filename: "a.png",
      expectedSizeBytes: png.length,
    });
    assert.equal(buffer.length, png.length);
  });
});

describe("validateMagicBytes", () => {
  it("rejects non-PDF bytes labeled as PDF", () => {
    assert.throws(
      () => validateMagicBytes(Buffer.from("not a pdf file!!!!"), "application/pdf", "x.pdf"),
      /not a valid PDF/,
    );
  });
});
