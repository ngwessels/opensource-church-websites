export const FONT_PRESETS = [
  { value: "Georgia, serif", label: "Georgia (Serif)" },
  { value: "Times New Roman, serif", label: "Times New Roman" },
  { value: "Garamond, serif", label: "Garamond" },
  { value: "Palatino, serif", label: "Palatino" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, sans-serif", label: "Helvetica" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "var(--font-geist-sans), sans-serif", label: "Geist Sans" },
];

export function isPresetFont(value) {
  return FONT_PRESETS.some((p) => p.value === value);
}
