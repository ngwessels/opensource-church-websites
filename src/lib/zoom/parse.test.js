import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isScheduleEntryJoinOpen,
  isZoomJoinVisible,
  ZOOM_JOIN_LEAD_MINUTES,
  ZOOM_STREAM_DURATION_MINUTES,
} from "./parse.js";

const sundayMass = { id: "1", day: "sunday", time: "10:00" };

function at(iso) {
  return new Date(iso);
}

describe("zoom/parse join visibility", () => {
  it("uses 15 minute lead and 1 hour duration defaults", () => {
    assert.equal(ZOOM_JOIN_LEAD_MINUTES, 15);
    assert.equal(ZOOM_STREAM_DURATION_MINUTES, 60);
  });

  it("shows join 15 minutes before Sunday 10:00 AM", () => {
    const schedule = [sundayMass];

    assert.equal(isZoomJoinVisible(schedule, at("2026-06-07T09:44:59")), false);
    assert.equal(isZoomJoinVisible(schedule, at("2026-06-07T09:45:00")), true);
    assert.equal(isZoomJoinVisible(schedule, at("2026-06-07T10:00:00")), true);
  });

  it("hides join 1 hour after Sunday 10:00 AM", () => {
    const schedule = [sundayMass];

    assert.equal(isZoomJoinVisible(schedule, at("2026-06-07T11:00:00")), true);
    assert.equal(isZoomJoinVisible(schedule, at("2026-06-07T11:00:01")), false);
    assert.equal(isZoomJoinVisible(schedule, at("2026-06-07T14:00:00")), false);
  });

  it("is hidden on other days outside the window", () => {
    assert.equal(isScheduleEntryJoinOpen(sundayMass, at("2026-06-08T10:00:00")), false);
    assert.equal(isScheduleEntryJoinOpen(sundayMass, at("2026-06-06T10:00:00")), false);
  });

  it("is always visible when no schedule is configured", () => {
    assert.equal(isZoomJoinVisible([]), true);
    assert.equal(isZoomJoinVisible(null), true);
  });
});
