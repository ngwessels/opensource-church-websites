"use client";

import { useDraggable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";

export const NAV_TEMPLATE_STYLES = {
  page: "bg-primary text-primary-foreground",
  secure_page: "bg-red-700 text-white",
  link: "bg-primary/85 text-primary-foreground",
  group: "border-2 border-dashed border-primary/40 bg-primary/5 text-primary",
};

export const NAV_TEMPLATE_LABELS = {
  page: "Page",
  secure_page: "Secure Page",
  link: "Link",
  group: "Link Group",
};

export function NavTemplateTile({ type, onAdd, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${type}`,
    data: { fromPalette: true, type },
    disabled: isOverlay,
  });

  const className = cn(
    "sitemap-template-tile rounded px-4 py-2.5 text-sm font-medium transition-opacity",
    NAV_TEMPLATE_STYLES[type],
    isOverlay
      ? "cursor-grabbing shadow-lg ring-2 ring-blue-300/60"
      : "cursor-grab hover:opacity-90 active:cursor-grabbing",
    isDragging && !isOverlay && "opacity-40",
  );

  if (isOverlay) {
    return (
      <div className={className}>{NAV_TEMPLATE_LABELS[type]}</div>
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
      {NAV_TEMPLATE_LABELS[type]}
    </button>
  );
}
