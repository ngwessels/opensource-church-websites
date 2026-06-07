"use client";

import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";

import { useSitemapDnd } from "./SitemapDndContext";

export function DropBefore({ nodeId }) {
  const { isDragging } = useSitemapDnd();
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-before-${nodeId}`,
    data: { type: "drop-before", nodeId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "sitemap-drop-indicator -mx-1 rounded-full transition-all",
        isDragging ? "h-2 py-0.5" : "h-0.5",
        isOver ? "bg-primary shadow-[0_0_0_2px] shadow-primary/20" : isDragging ? "bg-transparent" : "bg-transparent",
      )}
      aria-hidden
    />
  );
}

export function DropAfter({ nodeId }) {
  const { isDragging } = useSitemapDnd();
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-after-${nodeId}`,
    data: { type: "drop-after", nodeId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "sitemap-drop-indicator -mx-1 rounded-full transition-all",
        isDragging ? "h-2 py-0.5" : "h-0.5",
        isOver ? "bg-primary shadow-[0_0_0_2px] shadow-primary/20" : isDragging ? "bg-transparent" : "bg-transparent",
      )}
      aria-hidden
    />
  );
}

export function DropInto({ nodeId, disabled }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-into-${nodeId}`,
    data: { type: "drop-into", nodeId },
    disabled,
  });

  if (disabled) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "sitemap-drop-into absolute inset-0 rounded-lg transition-all",
        isOver && "bg-primary/10 ring-2 ring-inset ring-primary/50",
      )}
      aria-hidden
    />
  );
}
