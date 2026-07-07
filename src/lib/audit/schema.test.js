import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUDIT_SNAPSHOT_MAX_BYTES,
  buildAuditEventRecord,
  normalizeAuditAction,
  prepareSnapshotPayload,
} from "./schema.js";

describe("prepareSnapshotPayload", () => {
  it("returns data unchanged when under size limit", () => {
    const data = { title: "About" };
    const result = prepareSnapshotPayload(data);
    assert.equal(result.truncated, false);
    assert.deepEqual(result.data, data);
  });

  it("truncates oversized snapshots", () => {
    const data = { body: "x".repeat(AUDIT_SNAPSHOT_MAX_BYTES) };
    const result = prepareSnapshotPayload(data);
    assert.equal(result.truncated, true);
    assert.equal(result.data.truncated, true);
    assert.ok(result.originalSizeBytes > AUDIT_SNAPSHOT_MAX_BYTES);
  });
});

describe("buildAuditEventRecord", () => {
  it("builds a normalized audit event", () => {
    const event = buildAuditEventRecord({
      id: "audit_1",
      action: "update",
      actor: { uid: "u1", email: "admin@example.com", role: "admin" },
      source: "ui",
      resource: { type: "page", id: "page_1", slug: "about" },
      summary: "Updated page About",
      context: { builderPath: "/builder/edit/about", section: "modules" },
      hasBeforeSnapshot: true,
      hasAfterSnapshot: true,
    });

    assert.equal(event.id, "audit_1");
    assert.equal(event.action, "update");
    assert.equal(event.actor.uid, "u1");
    assert.equal(event.resource.type, "page");
    assert.equal(event.context?.builderPath, "/builder/edit/about");
    assert.equal(event.hasBeforeSnapshot, true);
    assert.equal(event.hasAfterSnapshot, true);
  });

  it("defaults unknown actions to update", () => {
    assert.equal(normalizeAuditAction("bogus"), "update");
  });
});
