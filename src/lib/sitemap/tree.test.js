import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildNavPageNode,
  collectDescendantNodeIds,
  slugify,
} from "./tree.js";

describe("sitemap/tree", () => {
  describe("collectDescendantNodeIds", () => {
    it("includes root and direct children", () => {
      const nodes = [
        { id: "a", parentId: null, order: 0 },
        { id: "b", parentId: "a", order: 0 },
        { id: "c", parentId: "a", order: 1 },
        { id: "d", parentId: null, order: 1 },
      ];
      const ids = collectDescendantNodeIds(nodes, "a");
      assert.deepEqual([...ids].sort(), ["a", "b", "c"]);
    });

    it("includes nested descendants", () => {
      const nodes = [
        { id: "a", parentId: null, order: 0 },
        { id: "b", parentId: "a", order: 0 },
        { id: "c", parentId: "b", order: 0 },
      ];
      const ids = collectDescendantNodeIds(nodes, "a");
      assert.deepEqual([...ids].sort(), ["a", "b", "c"]);
    });
  });

  describe("buildNavPageNode", () => {
    it("appends after existing siblings with incremented order", () => {
      const existing = [
        { id: "home", parentId: null, order: 0 },
        { id: "about", parentId: null, order: 1 },
      ];
      const node = buildNavPageNode({
        title: "Contact",
        existingNodes: existing,
        navId: "nav_contact",
        pageId: "page_contact",
      });
      assert.equal(node.title, "Contact");
      assert.equal(node.slug, "contact");
      assert.equal(node.order, 2);
      assert.equal(node.parentId, null);
      assert.equal(node.type, "page");
      assert.equal(node.id, "nav_contact");
      assert.equal(node.pageId, "page_contact");
    });

    it("slugifies title when slug omitted", () => {
      const node = buildNavPageNode({
        title: "Mass Times",
        existingNodes: [],
        navId: "n1",
        pageId: "p1",
      });
      assert.equal(node.slug, "mass-times");
    });
  });

  describe("slugify", () => {
    it("normalizes titles to URL segments", () => {
      assert.equal(slugify("About Us"), "about-us");
    });
  });
});
