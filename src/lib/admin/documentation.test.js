import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createEmptyNote, normalizeAdminDocumentation } from "./documentation.js";

describe("normalizeAdminDocumentation", () => {
  it("returns empty notes for missing data", () => {
    const result = normalizeAdminDocumentation(null);
    assert.equal(result.notes.length, 0);
    assert.ok(result.updatedAt);
  });

  it("sorts notes by order and reindexes", () => {
    const result = normalizeAdminDocumentation({
      notes: [
        { id: "b", title: "Second", body: "B", order: 2, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        { id: "a", title: "First", body: "A", order: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
      ],
    });
    assert.equal(result.notes.length, 2);
    assert.equal(result.notes[0].id, "a");
    assert.equal(result.notes[1].id, "b");
    assert.equal(result.notes[0].order, 0);
    assert.equal(result.notes[1].order, 1);
  });

  it("trims title and body", () => {
    const result = normalizeAdminDocumentation({
      notes: [{ id: "x", title: "  Title  ", body: "  Body  ", order: 0 }],
    });
    assert.equal(result.notes[0].title, "Title");
    assert.equal(result.notes[0].body, "Body");
  });
});

describe("createEmptyNote", () => {
  it("creates a note with id and timestamps", () => {
    const note = createEmptyNote();
    assert.ok(note.id);
    assert.equal(note.title, "");
    assert.equal(note.body, "");
    assert.ok(note.createdAt);
    assert.ok(note.updatedAt);
  });
});
