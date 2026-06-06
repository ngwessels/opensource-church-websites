const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;
const RGB = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;

function channelToHex(channel) {
  return Number(channel).toString(16).padStart(2, "0");
}

/** Normalize any supported CSS color to #rrggbb for <input type="color">. */
export function toHexColorInputValue(color, fallback = "#000000") {
  const source = (color?.trim() || fallback?.trim() || "#000000").trim();

  if (HEX6.test(source)) {
    return source.toLowerCase();
  }

  if (HEX3.test(source)) {
    const [, r, g, b] = source.match(/^#(.)(.)(.)$/);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const rgbMatch = source.match(RGB);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
  }

  if (HEX6.test(fallback)) {
    return fallback.toLowerCase();
  }

  return "#000000";
}
