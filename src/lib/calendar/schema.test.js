import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterUpcoming } from "./schema.js";

/** @param {string} iso */
function at(iso) {
  const real = Date;
  // @ts-expect-error test shim
  global.Date = class extends real {
    constructor(...args) {
      if (args.length === 0) {
        super(iso);
        return;
      }
      super(...args);
    }
    static now() {
      return new real(iso).getTime();
    }
  };
  return () => {
    global.Date = real;
  };
}

describe("calendar/schema filterUpcoming", () => {
  it("includes multi-day events that started before today but are still ongoing", () => {
    const restore = at("2026-06-23T15:00:00");
    try {
      const events = filterUpcoming([
        {
          id: "1",
          title: "Mission Krewe 2026",
          date: "2026-06-22",
          startTime: "",
          endTime: "",
          endDate: "2026-06-29",
          location: "",
          description: "",
          url: "",
        },
      ]);
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Mission Krewe 2026");
    } finally {
      restore();
    }
  });

  it("excludes multi-day events that have already ended", () => {
    const restore = at("2026-06-23T15:00:00");
    try {
      const events = filterUpcoming([
        {
          id: "1",
          title: "Past retreat",
          date: "2026-06-13",
          startTime: "",
          endTime: "",
          endDate: "2026-06-15",
          location: "",
          description: "",
          url: "",
        },
      ]);
      assert.equal(events.length, 0);
    } finally {
      restore();
    }
  });

  it("excludes timed events earlier today that have ended", () => {
    const restore = at("2026-06-23T15:00:00");
    try {
      const events = filterUpcoming([
        {
          id: "1",
          title: "Morning Mass",
          date: "2026-06-23",
          startTime: "08:00",
          endTime: "09:00",
          endDate: "",
          location: "",
          description: "",
          url: "",
        },
      ]);
      assert.equal(events.length, 0);
    } finally {
      restore();
    }
  });

  it("includes timed events later today", () => {
    const restore = at("2026-06-23T15:00:00");
    try {
      const events = filterUpcoming([
        {
          id: "1",
          title: "Evening meeting",
          date: "2026-06-23",
          startTime: "18:00",
          endTime: "19:00",
          endDate: "",
          location: "",
          description: "",
          url: "",
        },
      ]);
      assert.equal(events.length, 1);
    } finally {
      restore();
    }
  });
});
