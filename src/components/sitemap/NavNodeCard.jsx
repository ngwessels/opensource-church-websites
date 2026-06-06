"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, Lock, GripVertical } from "lucide-react";

import { getFullSlug } from "@/lib/sitemap/tree";

import { DropAfter, DropBefore, DropInto } from "./DropIndicator";

const ROOT_STYLES = {
  page: "bg-primary text-primary-foreground",
  secure_page: "bg-red-700 text-white",
  link: "bg-primary/85 text-primary-foreground",
  group: "border-2 border-dashed border-primary/40 bg-primary/5 text-primary",
};

function getCardStyle(node, depth) {
  if (depth === 0) {
    return ROOT_STYLES[node.type] || ROOT_STYLES.page;
  }
  switch (node.type) {
    case "page":
      return "bg-emerald-600 text-white";
    case "secure_page":
      return "bg-red-700 text-white";
    case "link":
      return "bg-primary/75 text-primary-foreground";
    case "group":
      return "border-2 border-dashed border-primary/40 bg-primary/5 text-primary";
    default:
      return "bg-emerald-600 text-white";
  }
}

export function NavNodeCard({
  node,
  nodes,
  depth = 0,
  pageType,
  onRename,
  onDelete,
  onView,
  onSettings,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { type: "nav-node", nodeId: node.id, node },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isQuickLink = node.isQuickLink;
  const isGroup = node.type === "group";
  const hasPage = node.type === "page" || node.type === "secure_page" || (isGroup && node.pageId);
  const fullSlug = nodes?.length ? getFullSlug(nodes, node.id) : node.slug ?? "";
  const showSlug = node.type === "page" || node.type === "secure_page" || isGroup;

  return (
    <div className="sitemap-node-wrapper">
      <DropBefore nodeId={node.id} />
      <div
        ref={setNodeRef}
        style={style}
        className={`sitemap-node-card group relative flex items-center gap-1 rounded px-2 py-1.5 text-sm ${getCardStyle(
          node,
          depth,
        )} ${isQuickLink ? "ring-2 ring-amber-400" : ""}`}
      >
        <DropInto nodeId={node.id} disabled={!isGroup} />
        <button
          type="button"
          className="relative z-10 cursor-grab opacity-60 hover:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="relative z-10 min-w-0 flex-1">
          <input
            defaultValue={node.title}
            onBlur={(e) => onRename(node.id, e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
          {showSlug && (
            <p className="truncate text-[10px] opacity-70">
              {fullSlug === "" ? "/" : `/${fullSlug}`}
              {pageType === "bulletins" && (
                <span className="ml-1 rounded bg-card/30 px-1 text-[9px] uppercase">Bulletins</span>
              )}
            </p>
          )}
        </div>
        {node.type === "link" && <ExternalLink className="relative z-10 h-3 w-3 shrink-0" />}
        {node.type === "secure_page" && <Lock className="relative z-10 h-3 w-3 shrink-0" />}
        <div className="relative z-10 hidden gap-1 group-hover:flex">
          {hasPage && onSettings && (
            <button
              type="button"
              onClick={() => onSettings(node)}
              className="rounded bg-card/20 px-1 text-xs"
            >
              SETTINGS
            </button>
          )}
          {hasPage && (
            <button
              type="button"
              onClick={() => onView(node)}
              className="rounded bg-card/20 px-1 text-xs"
            >
              VIEW
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="rounded bg-card/20 px-1 text-xs"
          >
            ×
          </button>
        </div>
      </div>
      <DropAfter nodeId={node.id} />
    </div>
  );
}
