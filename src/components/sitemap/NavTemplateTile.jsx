"use client";

import { useDraggable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";

import { NAV_TEMPLATE_TYPES, NAV_TYPE_META } from "./nav-type-meta";

export const NAV_TEMPLATE_STYLES = Object.fromEntries(
  NAV_TEMPLATE_TYPES.map((type) => [type, NAV_TYPE_META[type].tileClass]),
);

export const NAV_TEMPLATE_LABELS = {
  page: "Page",
  secure_page: "Secure Page",
  link: "Link",
  group: "Link Group",
};

export function NavTemplateTile({ type, onAdd, isOverlay = false }) {
  const meta = NAV_TYPE_META[type];
  const Icon = meta?.icon;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${type}`,
    data: { fromPalette: true, type },
    disabled: isOverlay,
  });

  const className = cn(
    "sitemap-template-tile inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
    meta?.tileClass,
    isOverlay
      ? "cursor-grabbing shadow-lg ring-2 ring-primary/30"
      : "cursor-grab shadow-sm hover:shadow-md active:cursor-grabbing",
    isDragging && !isOverlay && "opacity-40",
  );

  const label = NAV_TEMPLATE_LABELS[type];

  if (isOverlay) {
    return (
      <div className={className}>
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </div>
    );
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onAdd?.(type)}
      className={className}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
