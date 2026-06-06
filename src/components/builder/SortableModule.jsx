"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { ModuleRenderer } from "@/components/modules/ModuleRenderer";

export function SortableModule({
  module,
  regionId,
  siteConfig,
  editing,
  onEditModule,
  onSaveModule,
  onRemoveModule,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
    data: {
      moduleId: module.id,
      regionId,
      type: module.type,
      fromTray: false,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/sortable relative">
      {editing && (
        <button
          type="button"
          className="absolute -left-8 top-4 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground active:cursor-grabbing group-hover/sortable:opacity-100 [@media(hover:none)]:opacity-100"
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <ModuleRenderer
        module={module}
        siteConfig={siteConfig}
        editing={editing}
        onEdit={onEditModule}
        onSaveModule={onSaveModule}
        onRemove={onRemoveModule}
      />
    </div>
  );
}
