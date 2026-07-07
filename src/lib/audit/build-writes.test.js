import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAuditWrites } from "./build-writes.js";

describe("buildAuditWrites", () => {
  it("creates event and snapshot writes", () => {
    const { eventId, event, writes } = buildAuditWrites({
      action: "update",
      actor: { uid: "u1", email: "a@example.com" },
      source: "api",
      resource: { type: "page", id: "p1" },
      summary: "Updated page",
      before: { title: "Old" },
      after: { title: "New" },
    });

    assert.ok(eventId);
    assert.equal(event.summary, "Updated page");
    assert.equal(event.hasBeforeSnapshot, true);
    assert.equal(event.hasAfterSnapshot, true);
    assert.equal(writes.length, 3);
    const beforeWrite = writes.find((write) => write.refPath.endsWith("/snapshots/before"));
    assert.ok(beforeWrite);
    assert.equal("originalSizeBytes" in /** @type {Record<string, unknown>} */ (beforeWrite.data), false);
    assert.ok(writes.some((write) => write.refPath.endsWith("/snapshots/before")));
    assert.ok(writes.some((write) => write.refPath.endsWith("/snapshots/after")));
  });

  it("creates delete events with before snapshot only", () => {
    const { event, writes } = buildAuditWrites({
      action: "delete",
      actor: { uid: "u1" },
      source: "mcp",
      resource: { type: "media", id: "m1" },
      summary: "Deleted media",
      before: { name: "logo.png" },
    });

    assert.equal(event.hasBeforeSnapshot, true);
    assert.equal(event.hasAfterSnapshot, undefined);
    assert.equal(writes.length, 2);
  });
});
