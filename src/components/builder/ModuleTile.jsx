"use client";

import { useDraggable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import { MODULE_META } from "@/lib/design/admin-tokens";

export function ModuleTile({ type, onAddModule, isOverlay = false, isDragging = false }) {
  const meta = MODULE_META[type] || { label: type, color: "bg-muted0", icon: null };
  const Icon = meta.icon;

  const { attributes, listeners, setNodeRef, isDragging: dragging } = useDraggable({
    id: `tray-${type}`,
    data: { type, fromTray: true },
    disabled: isOverlay,
  });

  const className = cn(
    "group flex min-h-[116px] w-full flex-col items-center justify-center gap-2.5 rounded-xl border border-border/90 bg-card p-4 text-center shadow-sm transition-all",
    isOverlay
      ? "cursor-grabbing border-primary/30 shadow-lg ring-2 ring-primary/20"
      : "cursor-grab hover:border-border hover:shadow-md active:cursor-grabbing active:scale-[0.98]",
    (dragging || isDragging) && "opacity-40",
  );

  const iconBadgeClass = cn(
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105",
    meta.color,
  );

  if (isOverlay) {
    return (
      <div className={className}>
        <div className={iconBadgeClass}>{Icon && <Icon className="h-6 w-6" strokeWidth={1.75} />}</div>
        <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
          {meta.label}
        </span>
      </div>
    );
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onAddModule?.(type)}
      className={className}
    >
      <div className={iconBadgeClass}>{Icon && <Icon className="h-6 w-6" strokeWidth={1.75} />}</div>
      <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
        {meta.label}
      </span>
    </button>
  );
}
