import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectSearchableStrings,
  makeSnippet,
  searchInSiteData,
  stripHtml,
  textMatchesQuery,
} from "./content-search-core.js";

describe("cms/content-search", () => {
  it("stripHtml removes tags", () => {
    assert.equal(stripHtml("<p>Hello <strong>world</strong></p>"), "Hello world");
  });

  it("textMatchesQuery is case insensitive", () => {
    assert.equal(textMatchesQuery("Father John Smith", "john smith"), true);
    assert.equal(textMatchesQuery("Easter Vigil", "christmas"), false);
  });

  it("makeSnippet highlights around the match", () => {
    const snippet = makeSnippet("Join us for the parish picnic on Saturday afternoon", "picnic");
    assert.match(snippet, /picnic/i);
  });

  it("collectSearchableStrings walks nested module config", () => {
    const strings = collectSearchableStrings({
      title: "Staff",
      people: [{ name: "Jane Doe", role: "Secretary" }],
    });
    assert.ok(strings.some((s) => s.text === "Jane Doe"));
    assert.ok(strings.some((s) => s.path.includes("people")));
  });

  it("searchInSiteData finds people module names and page titles", () => {
    const result = searchInSiteData({
      query: "Jane Doe",
      pages: [
        {
          id: "page_1",
          title: "Staff",
          slug: "staff",
          regions: [
            {
              id: "content-1",
              modules: [
                {
                  id: "mod_1",
                  type: "people",
                  config: {
                    title: "Parish Staff",
                    people: [{ name: "Jane Doe", role: "Secretary" }],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    assert.equal(result.total, 1);
    assert.equal(result.results[0].source, "module");
    assert.equal(result.results[0].moduleType, "people");
    assert.equal(result.results[0].pageSlug, "staff");
  });

  it("searchInSiteData finds calendar event titles", () => {
    const result = searchInSiteData({
      query: "Fish Fry",
      pages: [
        {
          id: "page_2",
          title: "Events",
          slug: "events",
          regions: [
            {
              id: "content-1",
              modules: [
                {
                  id: "mod_cal",
                  type: "calendar",
                  config: {
                    title: "Calendar",
                    events: [{ id: "e1", title: "Lenten Fish Fry", date: "2026-03-14" }],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    assert.ok(result.total >= 1);
    assert.equal(result.results[0].moduleType, "calendar");
  });
});
