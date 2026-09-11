import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_CACHE_EXPIRE_NOW,
  PUBLIC_CACHE_REVALIDATE_SECONDS,
  PUBLIC_CACHE_TAGS,
} from "./tags.js";

describe("public cache tags", () => {
  it("uses a stable home-page tag for empty slugs", () => {
    assert.equal(PUBLIC_CACHE_TAGS.page(""), "public:page:home");
    assert.equal(PUBLIC_CACHE_TAGS.page("about"), "public:page:about");
  });

  it("expires published caches immediately instead of stale-while-revalidate", () => {
    assert.equal(PUBLIC_CACHE_EXPIRE_NOW.expire, 0);
    assert.equal(PUBLIC_CACHE_REVALIDATE_SECONDS, 60);
  });
});
