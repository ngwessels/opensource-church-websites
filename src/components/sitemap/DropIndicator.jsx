"use client";

import { useDroppable } from "@dnd-kit/core";

export function DropBefore({ nodeId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-before-${nodeId}`,
    data: { type: "drop-before", nodeId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`sitemap-drop-indicator h-1 rounded-full transition-all ${
        isOver ? "my-0.5 bg-primary" : "my-0 bg-transparent"
      }`}
    />
  );
}

export function DropAfter({ nodeId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-after-${nodeId}`,
    data: { type: "drop-after", nodeId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`sitemap-drop-indicator h-1 rounded-full transition-all ${
        isOver ? "my-0.5 bg-primary" : "my-0 bg-transparent"
      }`}
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
      className={`sitemap-drop-into absolute inset-0 rounded transition-all ${
        isOver ? "bg-primary/10 ring-2 ring-inset ring-primary/40" : ""
      }`}
    />
  );
}
