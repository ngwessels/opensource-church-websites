"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function quickLinkDragId(nodeId) {
  return `quick-link-${nodeId}`;
}

export function parseQuickLinkDragId(id) {
  return typeof id === "string" && id.startsWith("quick-link-") ? id.slice(11) : null;
}

function QuickLinkPill({ link }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: quickLinkDragId(link.id),
    data: { type: "quick-link", nodeId: link.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className="sitemap-quick-link-pill inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-sm font-medium text-white"
    >
      <button
        type="button"
        className="cursor-grab opacity-70 hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {link.title}
    </span>
  );
}

export function QuickLinksBar({ quickLinks }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "quick-links",
    data: { type: "quick-links" },
  });

  return (
    <div
      id="editQuickLinks"
      className={`sitemap-quick-links mb-4 rounded border-2 border-dashed px-4 py-3 ${
        isOver ? "border-amber-500 bg-amber-50" : "border-border bg-muted"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quick Links
      </p>
      <div
        id="qlSortableWrapper"
        ref={setNodeRef}
        className="flex min-h-[36px] flex-wrap items-center gap-2"
      >
        {quickLinks.length === 0 && (
          <span className="text-sm italic text-muted-foreground">
            Drag existing pages/links up to add
          </span>
        )}
        <SortableContext
          items={quickLinks.map((l) => quickLinkDragId(l.id))}
          strategy={horizontalListSortingStrategy}
        >
          {quickLinks.map((link, i) => (
            <span key={link.id} className="inline-flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground/30">|</span>}
              <QuickLinkPill link={link} />
            </span>
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
