"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ExternalLink, GripVertical, Link2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveNavHref } from "@/lib/sitemap/tree";
import { cn } from "@/lib/utils";

export function quickLinkDragId(nodeId) {
  return `quick-link-${nodeId}`;
}

export function parseQuickLinkDragId(id) {
  return typeof id === "string" && id.startsWith("quick-link-") ? id.slice(11) : null;
}

function QuickLinkItem({ link, nodes, onRename, onRemove, onUpdateExternalUrl }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: quickLinkDragId(link.id),
    data: { type: "quick-link", nodeId: link.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const isExternal = link.type === "link";
  const destination = isExternal
    ? link.externalUrl || ""
    : nodes?.length
      ? resolveNavHref(nodes, link)
      : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "sitemap-quick-link-item flex w-full min-w-[200px] max-w-[280px] flex-col rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 shadow-sm sm:w-auto sm:min-w-[220px]",
        isDragging && "shadow-md",
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="cursor-grab text-amber-700/70 transition-opacity hover:text-amber-800 active:cursor-grabbing dark:text-amber-400"
          aria-label={`Drag ${link.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          defaultValue={link.title}
          onBlur={(e) => {
            const title = e.target.value.trim();
            if (title && title !== link.title) onRename(link.id, title);
          }}
          placeholder="Link label"
          className="h-8 flex-1 border-amber-500/20 bg-card text-sm"
          aria-label="Quick link label"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onRemove(link.id)}
              className="shrink-0 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
              aria-label="Remove from quick links"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Remove from quick links</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 h-8">
        {isExternal ? (
          <div className="relative h-full">
            <ExternalLink className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              defaultValue={link.externalUrl || ""}
              onBlur={(e) => onUpdateExternalUrl(link.id, e.target.value.trim())}
              placeholder="https://example.com"
              className="h-full border-amber-500/20 bg-card pl-8 text-xs"
              aria-label="External URL"
            />
          </div>
        ) : (
          <p className="flex h-full items-center truncate pl-6 font-mono text-[11px] text-muted-foreground">
            {destination ? `→ ${destination}` : "\u00A0"}
          </p>
        )}
      </div>
    </div>
  );
}

export function QuickLinksBar({
  quickLinks,
  nodes,
  onRename,
  onRemove,
  onUpdateExternalUrl,
}) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: "quick-links",
    data: { type: "quick-links" },
  });

  useEffect(() => {
    if (isOver) setOpen(true);
  }, [isOver]);

  return (
    <section
      id="editQuickLinks"
      ref={setNodeRef}
      className={cn(
        "sitemap-quick-links mb-6 rounded-xl border-2 border-dashed transition-colors",
        isOver ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="qlSortableWrapper"
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
          <Link2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Quick Links</h2>
            {quickLinks.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                {quickLinks.length}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {open
              ? "Shortcuts shown in the header — drag pages here, then edit labels below"
              : quickLinks.length > 0
                ? quickLinks.map((link) => link.title).join(" · ")
                : "Shortcuts shown in the header — expand to edit"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id="qlSortableWrapper"
          className="flex min-h-[44px] flex-wrap items-stretch gap-3 border-t border-border/60 px-5 py-4"
        >
          {quickLinks.length === 0 && (
            <span className="flex w-full items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Drag an existing page or link here to add a quick link
            </span>
          )}
          <SortableContext
            items={quickLinks.map((l) => quickLinkDragId(l.id))}
            strategy={horizontalListSortingStrategy}
          >
            {quickLinks.map((link) => (
              <QuickLinkItem
                key={link.id}
                link={link}
                nodes={nodes}
                onRename={onRename}
                onRemove={onRemove}
                onUpdateExternalUrl={onUpdateExternalUrl}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </section>
  );
}
