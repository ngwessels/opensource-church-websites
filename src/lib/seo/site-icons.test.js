import assert from "node:assert/strict";
import test from "node:test";

import { buildSiteIconsMetadata } from "./site-icons.js";

test("buildSiteIconsMetadata returns undefined without a favicon URL", () => {
  assert.equal(buildSiteIconsMetadata(undefined), undefined);
  assert.equal(buildSiteIconsMetadata({ faviconUrl: "" }), undefined);
  assert.equal(buildSiteIconsMetadata({ faviconUrl: "   " }), undefined);
});

test("buildSiteIconsMetadata maps favicon URLs to icon metadata", () => {
  const url =
    "https://firebasestorage.googleapis.com/v0/b/example/o/favicon.ico?alt=media&token=abc";
  assert.deepEqual(buildSiteIconsMetadata({ faviconUrl: url }), {
    icon: [{ url, type: "image/x-icon" }],
  });
});

test("buildSiteIconsMetadata infers mime type from file extension", () => {
  const url = "https://cdn.example.com/assets/favicon.svg";
  assert.deepEqual(buildSiteIconsMetadata({ faviconUrl: url }), {
    icon: [{ url, type: "image/svg+xml" }],
  });
});
