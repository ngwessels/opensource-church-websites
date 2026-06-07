"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { emptyFilters, FILTER_OPTIONS } from "@/lib/design/theme-filters";
import { cn } from "@/lib/utils";

function FilterGroup({ label, groupKey, options, active, onToggle }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = active.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(groupKey, opt.value)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition",
                isActive
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeFilterSidebar({ filters, onChange, resultCount, totalCount }) {
  const toggle = (groupKey, value) => {
    const current = filters[groupKey] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [groupKey]: next });
  };

  const hasFilters = Object.values(filters).some((arr) => arr.length > 0);

  return (
    <div className="flex h-full w-44 shrink-0 flex-col border-r bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Filter</p>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-1.5 py-0.5 text-xs"
            onClick={() => onChange(emptyFilters())}
          >
            Clear all
          </Button>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {resultCount} of {totalCount} themes
      </p>
      <div className="space-y-4 overflow-y-auto">
        <FilterGroup
          label="Dominant Color"
          groupKey="dominantColor"
          options={FILTER_OPTIONS.dominantColor}
          active={filters.dominantColor}
          onToggle={toggle}
        />
        <Separator />
        <FilterGroup
          label="Header Style"
          groupKey="headerVariant"
          options={FILTER_OPTIONS.headerVariant}
          active={filters.headerVariant}
          onToggle={toggle}
        />
        <Separator />
        <FilterGroup
          label="Module Style"
          groupKey="moduleVariant"
          options={FILTER_OPTIONS.moduleVariant}
          active={filters.moduleVariant}
          onToggle={toggle}
        />
        <Separator />
        <FilterGroup
          label="Mood"
          groupKey="mood"
          options={FILTER_OPTIONS.mood}
          active={filters.mood}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}
