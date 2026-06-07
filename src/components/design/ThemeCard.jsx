"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { ThemeMiniPreview } from "./ThemeMiniPreviews";

export function ThemeCard({ theme, selected, onClick, compact = false }) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative w-full rounded-lg border text-left transition",
        onClick && "cursor-pointer hover:border-primary/50",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border",
        compact ? "p-3" : "p-4",
      )}
    >
      {selected && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-3" />
        </span>
      )}
      <ThemeMiniPreview theme={theme} />
      <p className={cn("font-medium text-foreground", compact ? "mt-2 text-sm" : "mt-3")}>
        {theme.name}
      </p>
      {!compact && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{theme.description}</p>
      )}
      <div className="mt-2 flex gap-1">
        <span className="h-4 w-4 rounded-sm ring-1 ring-border" style={{ background: theme.colors.primary }} />
        <span className="h-4 w-4 rounded-sm ring-1 ring-border" style={{ background: theme.colors.secondary }} />
        <span className="h-4 w-4 rounded-sm ring-1 ring-border" style={{ background: theme.colors.accent }} />
      </div>
    </Wrapper>
  );
}
