"use client";

import { useDroppable } from "@dnd-kit/core";

export function InsertSlot({ regionId, index, isDragActive }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `insert-${regionId}-${index}`,
    data: { kind: "insert", regionId, index },
  });

  return (
    <div
      ref={setNodeRef}
      className={`insert-slot relative transition-all ${isOver ? "is-over h-6" : isDragActive ? "h-2" : "h-0.5"}`}
    >
      {isOver && (
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[var(--admin-accent)] shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
      )}
    </div>
  );
}
