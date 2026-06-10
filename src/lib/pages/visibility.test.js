import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterFooterConfigForPublic,
  filterNavTreeForPublic,
  filterQuickLinksForPublic,
  asHiddenPageSets,
  getHiddenPageSets,
  isHrefHidden,
  isPageHidden,
  normalizeSitePath,
  wouldHideHomePage,
} from "./visibility.js";
import {
  isSyncedQuickLinksColumn,
  quickLinksToFooterLinks,
  resolveFooterColumns,
  sortQuickLinks,
} from "../sitemap/tree.js";

describe("isPageHidden", () => {
  it("returns true only when hidden is explicitly true", () => {
    assert.equal(isPageHidden({ hidden: true }), true);
    assert.equal(isPageHidden({ hidden: false }), false);
    assert.equal(isPageHidden({}), false);
    assert.equal(isPageHidden(null), false);
  });
});

describe("wouldHideHomePage", () => {
  it("blocks hiding the home page", () => {
    assert.equal(wouldHideHomePage({ slug: "" }, true), true);
    assert.equal(wouldHideHomePage({ slug: "about" }, true), false);
    assert.equal(wouldHideHomePage({ slug: "" }, false), false);
  });
});

describe("normalizeSitePath", () => {
  it("normalizes internal paths and ignores external URLs", () => {
    assert.equal(normalizeSitePath("/contact"), "contact");
    assert.equal(normalizeSitePath("about/team/"), "about/team");
    assert.equal(normalizeSitePath("https://example.com"), null);
    assert.equal(normalizeSitePath("#"), null);
  });
});

describe("filterNavTreeForPublic", () => {
  it("removes hidden pages and prunes empty groups", () => {
    const hiddenPageIds = new Set(["page_contact"]);
    const tree = [
      {
        id: "g1",
        type: "group",
        title: "About",
        hideInNav: false,
        children: [
          {
            id: "n1",
            type: "page",
            title: "Contact",
            pageId: "page_contact",
            children: [],
          },
          {
            id: "n2",
            type: "page",
            title: "Staff",
            pageId: "page_staff",
            children: [],
          },
        ],
      },
      {
        id: "g2",
        type: "group",
        title: "Empty",
        hideInNav: false,
        children: [
          {
            id: "n3",
            type: "page",
            title: "Hidden only",
            pageId: "page_contact",
            children: [],
          },
        ],
      },
    ];

    const filtered = filterNavTreeForPublic(tree, hiddenPageIds);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "g1");
    assert.equal(filtered[0].children.length, 1);
    assert.equal(filtered[0].children[0].pageId, "page_staff");
  });
});

describe("filterQuickLinksForPublic", () => {
  it("removes quick links for hidden pages", () => {
    const hiddenPageIds = new Set(["page_contact"]);
    const quickLinks = [
      { id: "q1", pageId: "page_contact", isQuickLink: true },
      { id: "q2", pageId: "page_staff", isQuickLink: true },
    ];

    const filtered = filterQuickLinksForPublic(quickLinks, hiddenPageIds);
    assert.deepEqual(
      filtered.map((link) => link.id),
      ["q2"],
    );
  });
});

describe("filterFooterConfigForPublic", () => {
  it("removes footer links that point at hidden page slugs", () => {
    const hiddenSlugs = new Set(["contact"]);
    const footerConfig = {
      columns: [
        {
          title: "Resources",
          links: [
            { label: "Contact", href: "/contact" },
            { label: "Staff", href: "/about/staff" },
            { label: "External", href: "https://example.com" },
          ],
        },
      ],
    };

    const filtered = filterFooterConfigForPublic(footerConfig, hiddenSlugs);
    assert.deepEqual(
      filtered.columns[0].links.map((link) => link.label),
      ["Staff", "External"],
    );
    assert.equal(isHrefHidden("/contact", hiddenSlugs), true);
  });

  it("leaves synced quick-link columns unchanged for static link filtering", () => {
    const hiddenSlugs = new Set(["contact"]);
    const footerConfig = {
      columns: [
        {
          title: "Quick Links",
          source: "quickLinks",
          links: [{ label: "Contact", href: "/contact" }],
        },
      ],
    };

    const filtered = filterFooterConfigForPublic(footerConfig, hiddenSlugs);
    assert.deepEqual(filtered.columns[0].links, [{ label: "Contact", href: "/contact" }]);
  });
});

describe("footer quick links sync", () => {
  it("detects synced quick-link columns by source or title", () => {
    assert.equal(isSyncedQuickLinksColumn({ source: "quickLinks" }), true);
    assert.equal(isSyncedQuickLinksColumn({ title: "Quick Links" }), true);
    assert.equal(isSyncedQuickLinksColumn({ title: "Contact" }), false);
  });

  it("resolves footer columns from sitemap quick links", () => {
    const navNodes = [
      { id: "staff", type: "page", title: "Staff", slug: "staff", parentId: null, order: 0 },
      {
        id: "school",
        type: "link",
        title: "Our School",
        externalUrl: "https://school.example.com",
        parentId: null,
        order: 1,
        isQuickLink: true,
        quickLinkOrder: 1,
      },
      {
        id: "q-staff",
        type: "page",
        title: "Staff",
        slug: "staff",
        parentId: null,
        order: 0,
        isQuickLink: true,
        quickLinkOrder: 0,
      },
    ];
    const quickLinks = sortQuickLinks(navNodes);

    assert.deepEqual(quickLinksToFooterLinks(quickLinks, navNodes), [
      { label: "Staff", href: "/staff" },
      { label: "Our School", href: "https://school.example.com" },
    ]);

    const columns = resolveFooterColumns(
      [{ title: "Quick Links", links: [{ label: "Old", href: "/old" }] }],
      quickLinks,
      navNodes,
    );
    assert.deepEqual(columns[0].links, [
      { label: "Staff", href: "/staff" },
      { label: "Our School", href: "https://school.example.com" },
    ]);
  });
});

describe("asHiddenPageSets", () => {
  it("rehydrates arrays from unstable_cache into Sets", () => {
    const { pageIds, slugs } = asHiddenPageSets({
      pageIds: ["p1"],
      slugs: ["contact"],
    });

    assert.equal(pageIds instanceof Set, true);
    assert.equal(slugs instanceof Set, true);
    assert.equal(pageIds.has("p1"), true);
    assert.equal(slugs.has("contact"), true);
  });
});

describe("getHiddenPageSets", () => {
  it("collects hidden page ids and slugs", () => {
    const { pageIds, slugs } = getHiddenPageSets([
      { id: "p1", slug: "contact", hidden: true },
      { id: "p2", slug: "staff", hidden: false },
      { id: "p3", slug: "", hidden: true },
    ]);

    assert.deepEqual([...pageIds], ["p1", "p3"]);
    assert.deepEqual([...slugs], ["contact", ""]);
  });
});
