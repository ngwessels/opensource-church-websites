/** @typedef {'mobile' | 'tablet' | 'desktop'} ObjectPositionViewport */

/** @typedef {'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'} ObjectPositionPreset */

export const OBJECT_POSITION_PRESETS = /** @type {const} */ ([
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
]);

/** @type {Record<ObjectPositionPreset, string>} */
export const OBJECT_POSITION_CSS = {
  "top-left": "left top",
  top: "center top",
  "top-right": "right top",
  left: "left center",
  center: "center center",
  right: "right center",
  "bottom-left": "left bottom",
  bottom: "center bottom",
  "bottom-right": "right bottom",
};

const DEFAULT_PRESET = "center";

/**
 * @param {unknown} value
 * @returns {value is ObjectPositionPreset}
 */
export function isObjectPositionPreset(value) {
  return OBJECT_POSITION_PRESETS.includes(value);
}

/**
 * @param {ObjectPositionPreset | undefined | null} preset
 * @returns {string}
 */
export function presetToCss(preset) {
  return OBJECT_POSITION_CSS[preset || DEFAULT_PRESET] || OBJECT_POSITION_CSS[DEFAULT_PRESET];
}

/**
 * @param {Partial<Record<ObjectPositionViewport, ObjectPositionPreset>> | null | undefined} byViewport
 * @param {ObjectPositionViewport} viewport
 * @returns {ObjectPositionPreset}
 */
export function resolveObjectPositionPreset(byViewport, viewport) {
  if (viewport === "mobile") {
    return byViewport?.mobile && isObjectPositionPreset(byViewport.mobile)
      ? byViewport.mobile
      : DEFAULT_PRESET;
  }

  if (viewport === "tablet") {
    if (byViewport?.tablet && isObjectPositionPreset(byViewport.tablet)) {
      return byViewport.tablet;
    }
    return resolveObjectPositionPreset(byViewport, "mobile");
  }

  if (byViewport?.desktop && isObjectPositionPreset(byViewport.desktop)) {
    return byViewport.desktop;
  }
  return resolveObjectPositionPreset(byViewport, "tablet");
}

/**
 * @param {Partial<Record<ObjectPositionViewport, ObjectPositionPreset>> | null | undefined} byViewport
 * @param {ObjectPositionViewport} viewport
 * @returns {string}
 */
export function resolveObjectPositionCss(byViewport, viewport) {
  return presetToCss(resolveObjectPositionPreset(byViewport, viewport));
}

/**
 * @param {Partial<Record<ObjectPositionViewport, ObjectPositionPreset>> | null | undefined} byViewport
 * @returns {Record<string, string>}
 */
export function getObjectPositionStyleVars(byViewport) {
  return {
    "--hero-pos-mobile": resolveObjectPositionCss(byViewport, "mobile"),
    "--hero-pos-tablet": resolveObjectPositionCss(byViewport, "tablet"),
    "--hero-pos-desktop": resolveObjectPositionCss(byViewport, "desktop"),
  };
}

/**
 * @param {Partial<Record<ObjectPositionViewport, ObjectPositionPreset>> | null | undefined} byViewport
 * @param {ObjectPositionViewport | null | undefined} previewViewport
 * @returns {string}
 */
export function getObjectPositionInline(byViewport, previewViewport) {
  if (!previewViewport) {
    return resolveObjectPositionCss(byViewport, "desktop");
  }
  return resolveObjectPositionCss(byViewport, previewViewport);
}
