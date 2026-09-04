import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateMagicBytes } from "./validate-file.js";

describe("validateMagicBytes", () => {
  it("rejects non-PDF bytes labeled as PDF", () => {
    assert.throws(
      () => validateMagicBytes(Buffer.from("not a pdf file!!!!"), "application/pdf", "x.pdf"),
      /not a valid PDF/,
    );
  });

  it("accepts a PDF header", () => {
    assert.doesNotThrow(() =>
      validateMagicBytes(Buffer.from("%PDF-1.7\n% test"), "application/pdf", "ok.pdf"),
    );
  });

  it("accepts PNG magic bytes", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16, 1),
    ]);
    assert.doesNotThrow(() => validateMagicBytes(png, "image/png", "a.png"));
  });
});
