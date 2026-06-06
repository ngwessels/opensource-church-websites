import { cn } from "@/lib/utils";
import { toHexColorInputValue } from "@/lib/color/parse";

export function ColorInput({ value, fallback = "#000000", onChange, className }) {
  const displayValue = toHexColorInputValue(value, fallback);

  return (
    <input
      type="color"
      value={displayValue}
      onChange={(e) => onChange(e.target.value)}
      className={cn("color-input h-8 w-10 shrink-0 cursor-pointer rounded border border-border", className)}
      aria-label="Choose color"
    />
  );
}
