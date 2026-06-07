import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSitemapEntries, formatSitemapXml, getSiteBaseUrl, pageUrlFromSlug } from "./site-url.js";

describe("getSiteBaseUrl", () => {
  it("uses canonicalDomain with https when scheme omitted", () => {
    assert.equal(getSiteBaseUrl({ canonicalDomain: "www.example.org" }), "https://www.example.org");
  });

  it("preserves explicit http/https canonicalDomain", () => {
    assert.equal(
      getSiteBaseUrl({ canonicalDomain: "https://parish.example.org/" }),
      "https://parish.example.org",
    );
  });

  it("falls back to NEXT_PUBLIC_SITE_URL", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://env.example.org/";
    try {
      assert.equal(getSiteBaseUrl(null), "https://env.example.org");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});

describe("pageUrlFromSlug", () => {
  it("maps home slug to base URL", () => {
    assert.equal(pageUrlFromSlug("https://example.org", ""), "https://example.org");
  });

  it("maps nested slugs", () => {
    assert.equal(pageUrlFromSlug("https://example.org", "about/staff"), "https://example.org/about/staff");
  });
});

describe("buildSitemapEntries", () => {
  it("includes home, CMS pages, and static routes without duplicates", () => {
    const entries = buildSitemapEntries("https://example.org", [
      { slug: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      { slug: "about", updatedAt: "2026-01-02T00:00:00.000Z" },
    ]);

    assert.equal(entries.length, 3);
    assert.equal(entries[0].url, "https://example.org");
    assert.equal(entries[0].priority, 1);
    assert.equal(entries[1].url, "https://example.org/about");
    assert.equal(entries[2].url, "https://example.org/give");
  });
});

describe("formatSitemapXml", () => {
  it("emits valid urlset xml", () => {
    const xml = formatSitemapXml([
      {
        url: "https://example.org",
        lastModified: "2026-01-01T00:00:00.000Z",
        changeFrequency: "weekly",
        priority: 1,
      },
    ]);

    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<loc>https:\/\/example\.org<\/loc>/);
    assert.match(xml, /<lastmod>2026-01-01T00:00:00.000Z<\/lastmod>/);
  });
});
