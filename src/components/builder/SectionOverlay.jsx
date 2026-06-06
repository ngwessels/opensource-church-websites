"use client";

import { Settings } from "lucide-react";

import { cn } from "@/lib/utils";

export function SectionOverlay({ label, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute left-0 top-4 z-40 flex items-center gap-1 rounded-r-md bg-primary/90 px-2 py-2 text-[10px] font-bold tracking-wider text-primary-foreground shadow-md hover:bg-primary",
        className,
      )}
      style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
    >
      <Settings className="mb-1 h-3 w-3" style={{ writingMode: "horizontal-tb" }} />
      {label}
    </button>
  );
}
