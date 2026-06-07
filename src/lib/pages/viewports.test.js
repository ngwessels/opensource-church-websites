import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canReduceColumns } from "./regions.js";
import {
  buildResponsiveLayoutUpdates,
  getMaxContentColumns,
  getResponsiveContentColumns,
  getResponsiveContentMarginX,
  normalizeResponsiveLayout,
} from "./viewports.js";

describe("getResponsiveContentMarginX", () => {
  it("uses legacy contentMarginX when no viewport overrides exist", () => {
    const page = { contentMarginX: "lg" };
    assert.equal(getResponsiveContentMarginX(page, "mobile"), "lg");
    assert.equal(getResponsiveContentMarginX(page, "tablet"), "lg");
    assert.equal(getResponsiveContentMarginX(page, "desktop"), "lg");
  });

  it("uses per-viewport overrides when set", () => {
    const page = {
      contentMarginX: "lg",
      contentMarginXByViewport: { mobile: "none", tablet: "sm" },
    };
    assert.equal(getResponsiveContentMarginX(page, "mobile"), "none");
    assert.equal(getResponsiveContentMarginX(page, "tablet"), "sm");
    assert.equal(getResponsiveContentMarginX(page, "desktop"), "lg");
  });
});

describe("getResponsiveContentColumns", () => {
  it("defaults mobile and tablet to 1 for legacy pages", () => {
    const page = { contentColumns: 3 };
    assert.equal(getResponsiveContentColumns(page, "mobile"), 1);
    assert.equal(getResponsiveContentColumns(page, "tablet"), 1);
    assert.equal(getResponsiveContentColumns(page, "desktop"), 3);
  });

  it("uses per-viewport overrides when set", () => {
    const page = {
      contentColumns: 3,
      contentColumnsByViewport: { mobile: 1, tablet: 2, desktop: 3 },
    };
    assert.equal(getResponsiveContentColumns(page, "mobile"), 1);
    assert.equal(getResponsiveContentColumns(page, "tablet"), 2);
    assert.equal(getResponsiveContentColumns(page, "desktop"), 3);
  });
});

describe("getMaxContentColumns", () => {
  it("returns the largest column count across viewports", () => {
    const page = {
      contentColumns: 2,
      contentColumnsByViewport: { mobile: 1, tablet: 2, desktop: 3 },
    };
    assert.equal(getMaxContentColumns(page), 3);
  });

  it("uses legacy desktop count when no overrides exist", () => {
    assert.equal(getMaxContentColumns({ contentColumns: 3 }), 3);
  });
});

describe("normalizeResponsiveLayout", () => {
  it("fills viewport objects from legacy fields", () => {
    const result = normalizeResponsiveLayout({ contentMarginX: "sm", contentColumns: 2 });
    assert.deepEqual(result.contentMarginXByViewport, {
      mobile: "sm",
      tablet: "sm",
      desktop: "sm",
    });
    assert.deepEqual(result.contentColumnsByViewport, {
      mobile: 1,
      tablet: 1,
      desktop: 2,
    });
    assert.equal(result.contentColumns, 2);
  });
});

describe("buildResponsiveLayoutUpdates", () => {
  it("syncs legacy fields to desktop margin and max columns", () => {
    const result = buildResponsiveLayoutUpdates(
      { mobile: "none", tablet: "sm", desktop: "lg" },
      { mobile: 1, tablet: 2, desktop: 3 },
    );
    assert.equal(result.contentMarginX, "lg");
    assert.equal(result.contentColumns, 3);
    assert.deepEqual(result.contentColumnsByViewport, { mobile: 1, tablet: 2, desktop: 3 });
  });
});

describe("canReduceColumns with viewport max", () => {
  it("blocks reducing below the max column count in use", () => {
    const page = {
      contentColumns: 3,
      contentColumnsByViewport: { mobile: 1, tablet: 2, desktop: 3 },
      regions: [
        { id: "content-1", modules: [{ id: "a" }] },
        { id: "content-2", modules: [] },
        { id: "content-3", modules: [{ id: "b" }] },
      ],
    };
    assert.equal(canReduceColumns(page, 2).ok, false);
    assert.equal(canReduceColumns(page, 3).ok, true);
  });
});
