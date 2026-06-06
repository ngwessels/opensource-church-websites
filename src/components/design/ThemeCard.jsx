"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function ThemeMiniPreview({ theme }) {
  const { colors, fonts, layout } = theme;
  const isLightHeader =
    theme.meta?.mood === "light" && theme.meta?.dominantColor === "white";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <div
        className="flex items-center px-2 py-1.5"
        style={{
          background: colors.primary,
          justifyContent: layout.header === "logoLeft" ? "flex-start" : "center",
        }}
      >
        {layout.header === "logoLeft" && (
          <span
            className="mr-1.5 h-3 w-3 rounded-sm"
            style={{ background: colors.accent }}
          />
        )}
        <span
          className="truncate text-[9px] font-semibold leading-none"
          style={{
            fontFamily: fonts.heading,
            color: isLightHeader ? colors.secondary : "#ffffff",
          }}
        >
          Parish Name
        </span>
      </div>
      <div
        className="flex gap-1 px-2 py-1"
        style={{
          background: layout.nav === "transparent" ? "transparent" : colors.secondary,
        }}
      >
        {["Home", "About", "Contact"].map((label) => (
          <span
            key={label}
            className="text-[7px]"
            style={{
              fontFamily: fonts.body,
              color: layout.nav === "transparent" ? colors.secondary : "#ffffff",
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="space-y-0.5 px-2 py-1.5">
        <p
          className="text-[8px] font-semibold leading-tight"
          style={{ fontFamily: fonts.heading, color: colors.primary }}
        >
          Welcome
        </p>
        <p
          className="text-[7px] leading-tight text-zinc-500"
          style={{ fontFamily: fonts.body }}
        >
          Body text sample
        </p>
        <span
          className="inline-block h-1 w-6 rounded-full"
          style={{ background: colors.accent }}
        />
      </div>
    </div>
  );
}

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
