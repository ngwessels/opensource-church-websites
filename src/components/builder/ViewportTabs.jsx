"use client";

import { cn } from "@/lib/utils";
import {
  PAGE_VIEWPORTS,
  PAGE_VIEWPORT_LABELS,
  PAGE_VIEWPORT_SHORT_LABELS,
} from "@/lib/pages/viewports";

export function ViewportTabs({ value, onChange, className, size = "default" }) {
  return (
    <div
      className={cn(
        "flex gap-1 rounded-lg border border-border/90 bg-muted/80 p-0.5",
        className,
      )}
      role="tablist"
      aria-label="Viewport"
    >
      {PAGE_VIEWPORTS.map((viewport) => (
        <button
          key={viewport}
          type="button"
          role="tab"
          aria-selected={value === viewport}
          onClick={() => onChange(viewport)}
          className={cn(
            "flex-1 rounded-md capitalize transition-colors",
            size === "compact" ? "px-1.5 py-1 text-xs sm:px-2" : "px-3 py-1.5 text-sm",
            value === viewport
              ? "admin-tab-active bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="xl:hidden">{PAGE_VIEWPORT_SHORT_LABELS[viewport]}</span>
          <span className="hidden xl:inline">{PAGE_VIEWPORT_LABELS[viewport]}</span>
        </button>
      ))}
    </div>
  );
}
