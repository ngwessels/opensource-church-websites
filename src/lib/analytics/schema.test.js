import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDateInTimezone,
  isExcludedAnalyticsPath,
  normalizePagePath,
  validateCollectPayload,
  validateHeatmapBatchPayload,
} from "./schema.js";

describe("analytics/schema", () => {
  it("normalizes page paths", () => {
    assert.equal(normalizePagePath(""), "/");
    assert.equal(normalizePagePath("/about"), "/about");
    assert.equal(normalizePagePath("about/"), "/about");
  });

  it("excludes builder and auth paths", () => {
    assert.equal(isExcludedAnalyticsPath("/builder"), true);
    assert.equal(isExcludedAnalyticsPath("/builder/edit"), true);
    assert.equal(isExcludedAnalyticsPath("/login"), true);
    assert.equal(isExcludedAnalyticsPath("/about"), false);
  });

  it("validates page_view payloads", () => {
    const payload = validateCollectPayload({
      type: "page_view",
      pagePath: "/about",
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      visitorId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      pageTitle: "About",
    });
    assert.equal(payload.pagePath, "/about");
    assert.equal(payload.type, "page_view");
  });

  it("requires engagementMs for engagement events", () => {
    assert.throws(() =>
      validateCollectPayload({
        type: "engagement",
        pagePath: "/about",
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        visitorId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      }),
    );
  });

  it("formats dates in timezone", () => {
    const date = getDateInTimezone("2026-07-06T08:00:00.000Z", "America/Los_Angeles");
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("validates heatmap batch payloads", () => {
    const payload = validateHeatmapBatchPayload({
      type: "heatmap_batch",
      pagePath: "/about",
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      visitorId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      deviceType: "desktop",
      points: [
        { kind: "click", x: 0.4, y: 0.6 },
        { kind: "scroll", depth: 0.8 },
      ],
    });
    assert.equal(payload.points.length, 2);
    assert.equal(payload.deviceType, "desktop");
  });
});
