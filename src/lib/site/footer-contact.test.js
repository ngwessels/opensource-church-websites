import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildContactHtml,
  findContactColumnIndex,
  parseContactFromColumns,
  parseContactHtml,
  upsertContactColumn,
} from "./footer-contact.js";

describe("footer contact helpers", () => {
  it("parses bootstrap default HTML into three lines", () => {
    const fields = parseContactHtml(
      "<p>123 Main Street<br/>City, ST 12345<br/>555-555-5555</p>",
    );

    assert.deepEqual(fields, {
      street: "123 Main Street",
      cityLine: "City, ST 12345",
      phone: "555-555-5555",
      email: "",
    });
  });

  it("round-trips parse → build → parse", () => {
    const initial = {
      street: "456 Oak Ave",
      cityLine: "Portland, OR 97201",
      phone: "503-555-0100",
      email: "office@parish.org",
    };

    const roundTrip = parseContactHtml(buildContactHtml(initial));
    assert.deepEqual(roundTrip, initial);
  });

  it("buildContactHtml omits empty fields", () => {
    assert.equal(
      buildContactHtml({ street: "123 Main St", cityLine: "", phone: "555-5555", email: "" }),
      "<p>123 Main St<br/>555-5555</p>",
    );
    assert.equal(buildContactHtml({ street: "", cityLine: "", phone: "", email: "" }), "");
  });

  it("findContactColumnIndex prefers title Contact", () => {
    const columns = [
      { title: "Other", html: "<p>Other</p>" },
      { title: "Contact", html: "<p>Address</p>" },
      { title: "Quick Links", source: "quickLinks", links: [] },
    ];

    assert.equal(findContactColumnIndex(columns), 1);
  });

  it("findContactColumnIndex falls back to first html column", () => {
    const columns = [
      { title: "Parish Office", html: "<p>Address</p>" },
      { title: "Quick Links", source: "quickLinks", links: [] },
    ];

    assert.equal(findContactColumnIndex(columns), 0);
  });

  it("upsertContactColumn updates existing Contact column without altering Quick Links", () => {
    const columns = [
      { title: "Contact", html: "<p>Old</p>" },
      { title: "Quick Links", source: "quickLinks", links: [{ label: "Staff", href: "/staff" }] },
    ];

    const updated = upsertContactColumn(columns, "<p>New address</p>");

    assert.equal(updated[0].html, "<p>New address</p>");
    assert.deepEqual(updated[1], columns[1]);
  });

  it("upsertContactColumn creates Contact column when missing", () => {
    const columns = [{ title: "Quick Links", source: "quickLinks", links: [] }];
    const updated = upsertContactColumn(columns, "<p>123 Main St</p>");

    assert.equal(updated.length, 2);
    assert.equal(updated[0].title, "Contact");
    assert.equal(updated[0].html, "<p>123 Main St</p>");
    assert.deepEqual(updated[1], columns[0]);
  });

  it("parseContactFromColumns reads from matched column", () => {
    const fields = parseContactFromColumns([
      { title: "Contact", html: "<p>123 Main Street<br/>City, ST 12345</p>" },
      { title: "Quick Links", source: "quickLinks", links: [] },
    ]);

    assert.equal(fields.street, "123 Main Street");
    assert.equal(fields.cityLine, "City, ST 12345");
  });
});
