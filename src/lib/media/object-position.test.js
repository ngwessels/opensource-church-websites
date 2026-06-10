import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getObjectPositionInline,
  getObjectPositionStyleVars,
  presetToCss,
  resolveObjectPositionCss,
  resolveObjectPositionPreset,
} from "./object-position.js";

describe("presetToCss", () => {
  it("maps grid presets to CSS object-position values", () => {
    assert.equal(presetToCss("center"), "center center");
    assert.equal(presetToCss("right"), "right center");
    assert.equal(presetToCss("top-left"), "left top");
    assert.equal(presetToCss("bottom-right"), "right bottom");
  });

  it("defaults to center for missing values", () => {
    assert.equal(presetToCss(undefined), "center center");
  });
});

describe("resolveObjectPositionPreset", () => {
  it("falls back tablet to mobile and desktop to tablet then mobile", () => {
    const byViewport = { mobile: "left" };
    assert.equal(resolveObjectPositionPreset(byViewport, "mobile"), "left");
    assert.equal(resolveObjectPositionPreset(byViewport, "tablet"), "left");
    assert.equal(resolveObjectPositionPreset(byViewport, "desktop"), "left");
  });

  it("uses explicit per-viewport overrides when set", () => {
    const byViewport = { mobile: "left", tablet: "right", desktop: "top" };
    assert.equal(resolveObjectPositionPreset(byViewport, "mobile"), "left");
    assert.equal(resolveObjectPositionPreset(byViewport, "tablet"), "right");
    assert.equal(resolveObjectPositionPreset(byViewport, "desktop"), "top");
  });

  it("falls back desktop through tablet when desktop is unset", () => {
    const byViewport = { mobile: "bottom-left", tablet: "top-right" };
    assert.equal(resolveObjectPositionPreset(byViewport, "desktop"), "top-right");
  });

  it("defaults to center when nothing is set", () => {
    assert.equal(resolveObjectPositionPreset(undefined, "mobile"), "center");
    assert.equal(resolveObjectPositionPreset({}, "desktop"), "center");
  });
});

describe("resolveObjectPositionCss", () => {
  it("returns CSS values with fallbacks", () => {
    assert.equal(resolveObjectPositionCss({ mobile: "right" }, "tablet"), "right center");
  });
});

describe("getObjectPositionStyleVars", () => {
  it("returns CSS custom properties for all viewports", () => {
    const vars = getObjectPositionStyleVars({ mobile: "left", tablet: "right" });
    assert.equal(vars["--hero-pos-mobile"], "left center");
    assert.equal(vars["--hero-pos-tablet"], "right center");
    assert.equal(vars["--hero-pos-desktop"], "right center");
  });
});

describe("getObjectPositionInline", () => {
  it("uses preview viewport when provided", () => {
    assert.equal(
      getObjectPositionInline({ mobile: "left", desktop: "right" }, "mobile"),
      "left center",
    );
    assert.equal(
      getObjectPositionInline({ mobile: "left", desktop: "right" }, "desktop"),
      "right center",
    );
  });

  it("defaults to desktop resolution when preview viewport is absent", () => {
    assert.equal(
      getObjectPositionInline({ mobile: "left", desktop: "right" }, null),
      "right center",
    );
  });
});
