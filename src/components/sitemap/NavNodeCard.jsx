"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Settings, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getFullSlug } from "@/lib/sitemap/tree";

import { DropAfter, DropBefore, DropInto } from "./DropIndicator";
import { NAV_TYPE_META } from "./nav-type-meta";

function getCardClass(node, depth) {
  const meta = NAV_TYPE_META[node.type] || NAV_TYPE_META.page;
  if (depth === 0) return meta.rootClass;
  return meta.childClass;
}

export function NavNodeCard({
  node,
  nodes,
  depth = 0,
  pageType,
  pageHidden = false,
  onRename,
  onDelete,
  onView,
  onSettings,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { type: "nav-node", nodeId: node.id, node },
  });

  const meta = NAV_TYPE_META[node.type] || NAV_TYPE_META.page;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const isQuickLink = node.isQuickLink;
  const isGroup = node.type === "group";
  const hasPage = node.type === "page" || node.type === "secure_page" || (isGroup && node.pageId);
  const fullSlug = nodes?.length ? getFullSlug(nodes, node.id) : node.slug ?? "";
  const showSlug = node.type === "page" || node.type === "secure_page" || isGroup;
  const isRoot = depth === 0;

  return (
    <div className="sitemap-node-wrapper">
      <DropBefore nodeId={node.id} />
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "sitemap-node-card group relative flex items-stretch gap-0 overflow-hidden rounded-lg text-sm shadow-sm transition-shadow",
          getCardClass(node, depth),
          isQuickLink && "ring-2 ring-amber-400 ring-offset-1",
          isDragging && "shadow-md",
          !isRoot && "border border-border",
        )}
      >
        <DropInto nodeId={node.id} disabled={!isGroup} />

        {depth > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "absolute right-0 top-0 z-10 rounded-none rounded-bl-md rounded-tr-lg px-1.5 py-0.5 text-[10px] font-medium leading-none",
              meta.badgeClass,
            )}
          >
            {meta.label}
          </Badge>
        )}

        <button
          type="button"
          className={cn(
            "relative z-10 flex shrink-0 cursor-grab items-center px-1.5 opacity-50 transition-opacity hover:opacity-100 active:cursor-grabbing",
            isRoot ? "text-inherit" : "text-muted-foreground",
          )}
          aria-label={`Drag ${node.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className={cn("relative z-10 min-w-0 flex-1 py-2 pr-1", depth > 0 && "pr-11")}>
          <div className="flex min-w-0 items-center gap-1.5 transition-[padding] group-focus-within:pr-14 group-hover:pr-14">
            <input
              defaultValue={node.title}
              onBlur={(e) => onRename(node.id, e.target.value)}
              className={cn(
                "w-full min-w-0 bg-transparent text-sm font-medium outline-none",
                isRoot ? "text-inherit placeholder:text-inherit/60" : "text-foreground",
              )}
              aria-label="Page title"
            />
          </div>
          {(showSlug || pageType === "bulletins" || pageType === "donation" || pageHidden) && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 transition-[padding] group-focus-within:pr-14 group-hover:pr-14">
              {showSlug && (
                <p
                  className={cn(
                    "min-w-0 truncate font-mono text-[11px]",
                    isRoot ? "opacity-75" : "text-muted-foreground",
                  )}
                >
                  {fullSlug === "" ? "/" : `/${fullSlug}`}
                </p>
              )}
              {pageType === "bulletins" && (
                <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px] uppercase">
                  Bulletins
                </Badge>
              )}
              {pageType === "donation" && (
                <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px] uppercase">
                  Donation
                </Badge>
              )}
              {pageHidden && (
                <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[9px] uppercase">
                  Hidden
                </Badge>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            "absolute right-0 top-1/2 z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-r-lg bg-gradient-to-l pl-5 pr-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
            isRoot
              ? "from-black/30 via-black/10 to-transparent"
              : "from-card via-card/95 to-transparent",
          )}
        >
          {hasPage && onSettings && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onSettings(node)}
                  className={cn(isRoot && "text-inherit hover:bg-white/20")}
                  aria-label="Page settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Settings</TooltipContent>
            </Tooltip>
          )}
          {hasPage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onView(node)}
                  className={cn(isRoot && "text-inherit hover:bg-white/20")}
                  aria-label="Edit page"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit page</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onDelete(node)}
                className={cn(
                  "hover:bg-red-500/20 hover:text-red-600",
                  isRoot && "text-inherit hover:bg-white/20 hover:text-white",
                )}
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <DropAfter nodeId={node.id} />
    </div>
  );
}
