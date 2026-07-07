import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateAnalyticsEvents } from "./aggregate.js";

describe("analytics/query", () => {
  const events = [
    {
      type: "page_view",
      timestamp: "2026-07-01T10:00:00.000Z",
      date: "2026-07-01",
      pagePath: "/",
      pageTitle: "Home",
      sessionId: "s1",
      visitorId: "v1",
      isNewVisitor: true,
      referrer: "",
      deviceType: "desktop",
      browser: "Chrome",
      country: "US",
    },
    {
      type: "page_view",
      timestamp: "2026-07-01T10:01:00.000Z",
      date: "2026-07-01",
      pagePath: "/about",
      pageTitle: "About",
      sessionId: "s1",
      visitorId: "v1",
      referrer: "https://google.com/search",
      deviceType: "desktop",
      browser: "Chrome",
      country: "US",
    },
    {
      type: "page_view",
      timestamp: "2026-07-01T11:00:00.000Z",
      date: "2026-07-01",
      pagePath: "/",
      pageTitle: "Home",
      sessionId: "s2",
      visitorId: "v2",
      referrer: "",
      deviceType: "mobile",
      browser: "Safari",
      country: "US",
    },
    {
      type: "engagement",
      timestamp: "2026-07-01T10:02:00.000Z",
      date: "2026-07-01",
      pagePath: "/about",
      sessionId: "s1",
      visitorId: "v1",
      engagementMs: 45000,
    },
  ];

  it("aggregates summary metrics", () => {
    const report = aggregateAnalyticsEvents(events, {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-01",
    });

    assert.equal(report.summary.pageViews, 3);
    assert.equal(report.summary.sessions, 2);
    assert.equal(report.summary.visitors, 2);
    assert.equal(report.summary.newVisitors, 1);
    assert.equal(report.summary.pagesPerSession, 1.5);
    assert.equal(report.summary.bounceRate, 0.5);
    assert.equal(report.summary.avgEngagementMs, 45000);
  });

  it("filters by page path", () => {
    const report = aggregateAnalyticsEvents(events, {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-01",
      pagePath: "/about",
    });

    assert.equal(report.summary.pageViews, 1);
    assert.equal(report.topPages.length, 1);
    assert.equal(report.topPages[0].pagePath, "/about");
  });

  it("builds daily trend and top pages", () => {
    const report = aggregateAnalyticsEvents(events, {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-01",
    });

    assert.equal(report.dailyTrend.length, 1);
    assert.equal(report.dailyTrend[0].pageViews, 3);
    assert.equal(report.topPages[0].pagePath, "/");
    assert.equal(report.topPages[0].pageViews, 2);
    assert.ok(report.referrers.some((row) => row.label === "google.com"));
  });
});
