import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeHeatmapRollups } from "./heatmap-merge.js";

describe("analytics/heatmap-query", () => {
  it("merges rollup documents for a page", () => {
    const report = mergeHeatmapRollups(
      [
        {
          date: "2026-07-01",
          pagePath: "/about",
          deviceType: "desktop",
          gridSize: 40,
          sessions: 2,
          clicks: { "10_10": 3, "10_11": 1 },
          scrollBuckets: { "0": 2, "50": 1 },
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          date: "2026-07-02",
          pagePath: "/about",
          deviceType: "desktop",
          gridSize: 40,
          sessions: 1,
          clicks: { "10_10": 2 },
          scrollBuckets: { "100": 1 },
          updatedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      40,
    );

    assert.equal(report.totalClicks, 6);
    assert.equal(report.totalSessions, 3);
    assert.equal(report.scrollBuckets.length, 3);
    assert.equal(report.hotspots[0].count, 5);
    assert.equal(report.clicks[0].row, 10);
  });
});
