import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHeatmapIncrementPaths } from "./heatmap-increments.js";
import { mergeHeatmapRollups, normalizeHeatmapRollupMaps } from "./heatmap-merge.js";

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

  it("recovers click and scroll maps stored as dotted top-level fields", () => {
    const normalized = normalizeHeatmapRollupMaps({
      date: "2026-07-01",
      pagePath: "/",
      deviceType: "mobile",
      sessions: 4,
      "clicks.12_8": 7,
      "clicks.3_3": 2,
      "scrollBuckets.0": 4,
      "scrollBuckets.70": 3,
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    assert.equal(normalized.sessions, 4);
    assert.equal(normalized.clicks["12_8"], 7);
    assert.equal(normalized.clicks["3_3"], 2);
    assert.equal(normalized.scrollBuckets["0"], 4);
    assert.equal(normalized.scrollBuckets["70"], 3);
  });

  it("merges legacy dotted fields with nested maps", () => {
    const report = mergeHeatmapRollups(
      [
        {
          date: "2026-07-01",
          pagePath: "/",
          deviceType: "desktop",
          gridSize: 40,
          sessions: 2,
          "clicks.1_1": 3,
          "scrollBuckets.40": 2,
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          date: "2026-07-02",
          pagePath: "/",
          deviceType: "desktop",
          gridSize: 40,
          sessions: 1,
          clicks: { "1_1": 1 },
          scrollBuckets: { "40": 1, "90": 1 },
          updatedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      40,
    );

    assert.equal(report.totalClicks, 4);
    assert.equal(report.totalSessions, 3);
    assert.deepEqual(
      report.scrollBuckets.map((row) => [row.depthPercent, row.sessions]),
      [
        [40, 3],
        [90, 1],
      ],
    );
  });
});

describe("analytics/heatmap-increments", () => {
  it("builds dotted update paths for clicks and scrolls", () => {
    const { paths, clickCount, scrollCount } = buildHeatmapIncrementPaths([
      { kind: "click", x: 0.25, y: 0.5 },
      { kind: "scroll", depth: 0.82 },
    ]);

    assert.equal(clickCount, 1);
    assert.equal(scrollCount, 1);
    assert.equal(paths.length, 2);
    assert.ok(paths.some((path) => path.startsWith("clicks.")));
    assert.ok(paths.includes("scrollBuckets.80"));
  });
});
