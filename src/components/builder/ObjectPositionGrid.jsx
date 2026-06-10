"use client";

import { cn } from "@/lib/utils";
import { OBJECT_POSITION_PRESETS } from "@/lib/media/object-position";

const GRID_LABELS = {
  "top-left": "Top left",
  top: "Top",
  "top-right": "Top right",
  left: "Left",
  center: "Center",
  right: "Right",
  "bottom-left": "Bottom left",
  bottom: "Bottom",
  "bottom-right": "Bottom right",
};

export function ObjectPositionGrid({ value = "center", onChange, className }) {
  return (
    <div
      className={cn("inline-grid grid-cols-3 gap-1", className)}
      role="group"
      aria-label="Image focus"
    >
      {OBJECT_POSITION_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(preset)}
          aria-label={GRID_LABELS[preset]}
          aria-pressed={value === preset}
          className={cn(
            "h-8 w-8 rounded border text-[10px] transition-colors",
            value === preset
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          <span className="sr-only">{GRID_LABELS[preset]}</span>
          <span
            aria-hidden
            className={cn(
              "mx-auto block h-1.5 w-1.5 rounded-full",
              value === preset ? "bg-primary" : "bg-muted-foreground/60",
            )}
          />
        </button>
      ))}
    </div>
  );
}
