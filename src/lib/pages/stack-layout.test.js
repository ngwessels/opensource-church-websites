import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTENT_STACK_REGION_ID,
  getContentStackOrder,
  getDefaultContentStackOrder,
  getStackedContentModules,
  hasCustomContentStackOrder,
  insertIntoContentStack,
  reconcileContentStackOrders,
  removeFromContentStackOrders,
  reorderContentStack,
  usesStackedContentLayout,
} from "./stack-layout.js";

const samplePage = {
  contentColumns: 2,
  contentColumnsByViewport: { mobile: 1, tablet: 1, desktop: 2 },
  regions: [
    {
      id: "content-1",
      modules: [
        { id: "links", type: "links", region: "content-1", order: 0 },
        { id: "gallery", type: "gallery", region: "content-1", order: 1 },
      ],
    },
    {
      id: "content-2",
      modules: [
        { id: "text", type: "text", region: "content-2", order: 0 },
        { id: "mass", type: "mass_times", region: "content-2", order: 1 },
      ],
    },
  ],
};

describe("usesStackedContentLayout", () => {
  it("returns true for mobile/tablet when column count is 1", () => {
    assert.equal(usesStackedContentLayout(samplePage, "mobile"), true);
    assert.equal(usesStackedContentLayout(samplePage, "tablet"), true);
  });

  it("returns false for desktop", () => {
    assert.equal(usesStackedContentLayout(samplePage, "desktop"), false);
  });

  it("returns false for tablet when configured with 2 columns", () => {
    const page = {
      ...samplePage,
      contentColumnsByViewport: { mobile: 1, tablet: 2, desktop: 2 },
    };
    assert.equal(usesStackedContentLayout(page, "tablet"), false);
  });
});

describe("getDefaultContentStackOrder", () => {
  it("walks content regions left to right", () => {
    assert.deepEqual(getDefaultContentStackOrder(samplePage), [
      "links",
      "gallery",
      "text",
      "mass",
    ]);
  });
});

describe("getContentStackOrder", () => {
  it("uses explicit viewport order when set", () => {
    const page = {
      ...samplePage,
      contentStackOrderByViewport: {
        mobile: ["mass", "text", "links", "gallery"],
      },
    };
    assert.deepEqual(getContentStackOrder(page, "mobile"), [
      "mass",
      "text",
      "links",
      "gallery",
    ]);
  });

  it("reconciles unknown ids and appends missing modules", () => {
    const page = {
      ...samplePage,
      contentStackOrderByViewport: {
        mobile: ["mass", "deleted", "links"],
      },
    };
    assert.deepEqual(getContentStackOrder(page, "mobile"), [
      "mass",
      "links",
      "gallery",
      "text",
    ]);
  });
});

describe("reorderContentStack", () => {
  it("stores custom mobile order without changing regions", () => {
    const next = reorderContentStack(samplePage, "mobile", [
      "mass",
      "text",
      "links",
      "gallery",
    ]);
    assert.deepEqual(next.contentStackOrderByViewport.mobile, [
      "mass",
      "text",
      "links",
      "gallery",
    ]);
    assert.deepEqual(next.regions, samplePage.regions);
  });
});

describe("insertIntoContentStack", () => {
  it("inserts a module id at the requested index", () => {
    const next = insertIntoContentStack(samplePage, "mobile", "mass", 0);
    assert.deepEqual(next.contentStackOrderByViewport.mobile, [
      "mass",
      "links",
      "gallery",
      "text",
    ]);
  });
});

describe("removeFromContentStackOrders", () => {
  it("removes module id from all stack arrays", () => {
    const page = {
      ...samplePage,
      contentStackOrderByViewport: {
        mobile: ["mass", "text", "links", "gallery"],
        tablet: ["text", "mass", "links", "gallery"],
      },
    };
    const next = removeFromContentStackOrders(page, "mass");
    assert.deepEqual(next.contentStackOrderByViewport.mobile, ["text", "links", "gallery"]);
    assert.deepEqual(next.contentStackOrderByViewport.tablet, ["text", "links", "gallery"]);
  });
});

describe("reconcileContentStackOrders", () => {
  it("drops stack overrides that match default order", () => {
    const page = {
      ...samplePage,
      contentStackOrderByViewport: {
        mobile: ["links", "gallery", "text", "mass"],
      },
    };
    const next = reconcileContentStackOrders(page);
    assert.equal(next.contentStackOrderByViewport, undefined);
  });
});

describe("getStackedContentModules", () => {
  it("returns module objects in stack order", () => {
    const page = {
      ...samplePage,
      contentStackOrderByViewport: {
        mobile: ["mass", "text", "links", "gallery"],
      },
    };
    const modules = getStackedContentModules(page, "mobile");
    assert.deepEqual(
      modules.map((m) => m.id),
      ["mass", "text", "links", "gallery"],
    );
  });
});

describe("hasCustomContentStackOrder", () => {
  it("detects custom order", () => {
    const page = reorderContentStack(samplePage, "mobile", [
      "mass",
      "text",
      "links",
      "gallery",
    ]);
    assert.equal(hasCustomContentStackOrder(page, "mobile"), true);
    assert.equal(hasCustomContentStackOrder(samplePage, "mobile"), false);
  });
});

describe("CONTENT_STACK_REGION_ID", () => {
  it("is exported for builder drag targets", () => {
    assert.equal(CONTENT_STACK_REGION_ID, "content-stack");
  });
});
