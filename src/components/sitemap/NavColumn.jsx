"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { cn } from "@/lib/utils";

import { NavNodeCard } from "./NavNodeCard";

function NavChildren({
  allNodes,
  nodes,
  depth,
  maxLevel,
  pageTypeMap,
  pageHiddenMap,
  onRename,
  onDelete,
  onView,
  onSettings,
}) {
  if (depth >= maxLevel) return null;

  return (
    <div className="sitemap-children mt-2 space-y-1 pl-3">
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => (
          <div key={node.id}>
            <NavNodeCard
              node={node}
              nodes={allNodes}
              depth={depth}
              pageType={node.pageId ? pageTypeMap?.[node.pageId] : undefined}
              pageHidden={node.pageId ? pageHiddenMap?.[node.pageId] : false}
              onRename={onRename}
              onDelete={onDelete}
              onView={onView}
              onSettings={onSettings}
            />
            {node.children?.length > 0 && (
              <NavChildren
                allNodes={allNodes}
                nodes={node.children}
                depth={depth + 1}
                maxLevel={maxLevel}
                pageTypeMap={pageTypeMap}
                pageHiddenMap={pageHiddenMap}
                onRename={onRename}
                onDelete={onDelete}
                onView={onView}
                onSettings={onSettings}
              />
            )}
          </div>
        ))}
      </SortableContext>
    </div>
  );
}

export function NavColumn({
  column,
  allNodes,
  maxLevel,
  pageTypeMap,
  pageHiddenMap,
  onRename,
  onDelete,
  onView,
  onSettings,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  const childCount = column.children?.length ?? 0;

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "sitemap-column flex w-[240px] shrink-0 list-none flex-col rounded-xl border border-border/80 bg-card p-3 shadow-sm transition-all",
        isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/20",
      )}
    >
      <NavNodeCard
        node={column}
        nodes={allNodes}
        depth={0}
        pageType={column.pageId ? pageTypeMap?.[column.pageId] : undefined}
        pageHidden={column.pageId ? pageHiddenMap?.[column.pageId] : false}
        onRename={onRename}
        onDelete={onDelete}
        onView={onView}
        onSettings={onSettings}
      />
      {childCount > 0 && (
        <NavChildren
          allNodes={allNodes}
          nodes={column.children}
          depth={1}
          maxLevel={maxLevel}
          pageTypeMap={pageTypeMap}
          pageHiddenMap={pageHiddenMap}
          onRename={onRename}
          onDelete={onDelete}
          onView={onView}
          onSettings={onSettings}
        />
      )}
      {childCount === 0 && (
        <p className="mt-3 rounded-md border border-dashed border-border/80 px-2 py-3 text-center text-xs text-muted-foreground">
          Drop pages here
        </p>
      )}
    </li>
  );
}
