import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createEmptyFormField,
  normalizeFormConfig,
  normalizeFormField,
  validateFormConfig,
  validateSubmission,
} from "./schema.js";

describe("forms/schema", () => {
  it("normalizeFormConfig provides defaults", () => {
    const config = normalizeFormConfig(null);
    assert.ok(config.formId);
    assert.equal(config.submitLabel, "Submit");
    assert.ok(config.honeypotFieldName.startsWith("_hp_"));
  });

  it("preserves formId when requested", () => {
    const config = normalizeFormConfig({ formId: "form_abc", fields: [] }, { preserveFormId: true });
    assert.equal(config.formId, "form_abc");
  });

  it("parses notification emails", () => {
    const config = normalizeFormConfig({
      notificationEmails: ["a@b.com", "invalid", "c@d.org"],
      fields: [{ id: "1", type: "text", label: "Name", required: true }],
    });
    assert.deepEqual(config.notificationEmails, ["a@b.com", "c@d.org"]);
  });

  it("validateFormConfig requires input fields", () => {
    const empty = validateFormConfig(
      normalizeFormConfig({ fields: [{ id: "1", type: "heading", label: "Hi" }] }),
    );
    assert.equal(empty.ok, false);

    const ok = validateFormConfig(
      normalizeFormConfig({
        fields: [{ id: "1", type: "text", label: "Name", required: true }],
      }),
    );
    assert.equal(ok.ok, true);
  });

  it("validateSubmission checks required email", () => {
    const config = normalizeFormConfig({
      fields: [
        { id: "email", type: "email", label: "Email", required: true },
        { id: "msg", type: "textarea", label: "Message" },
      ],
    });

    const missing = validateSubmission(config, {});
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.ok(missing.errors.email);
    }

    const badEmail = validateSubmission(config, { email: "not-an-email" });
    assert.equal(badEmail.ok, false);

    const ok = validateSubmission(config, { email: "user@example.com", msg: "Hello" });
    assert.equal(ok.ok, true);
  });

  it("normalizeFormField assigns id for new fields", () => {
    const field = createEmptyFormField("select");
    assert.ok(field.id);
    assert.equal(field.type, "select");

    const normalized = normalizeFormField({ type: "file", label: "Upload" });
    assert.equal(normalized.maxFileSizeMb, 10);
  });
});
