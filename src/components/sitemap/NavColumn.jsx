"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { NavNodeCard } from "./NavNodeCard";

function NavChildren({
  allNodes,
  nodes,
  depth,
  maxLevel,
  pageTypeMap,
  onRename,
  onDelete,
  onView,
  onSettings,
}) {
  if (depth >= maxLevel) return null;

  return (
    <div className="sitemap-children mt-1 space-y-0 pl-2">
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => (
          <div key={node.id}>
            <NavNodeCard
              node={node}
              nodes={allNodes}
              depth={depth}
              pageType={node.pageId ? pageTypeMap?.[node.pageId] : undefined}
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
  onRename,
  onDelete,
  onView,
  onSettings,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  return (
    <li
      ref={setNodeRef}
      className={`sitemap-column min-w-[160px] flex-1 list-none rounded bg-card p-2 shadow-sm ${
        isOver ? "ring-2 ring-blue-400" : ""
      }`}
    >
      <NavNodeCard
        node={column}
        nodes={allNodes}
        depth={0}
        pageType={column.pageId ? pageTypeMap?.[column.pageId] : undefined}
        onRename={onRename}
        onDelete={onDelete}
        onView={onView}
        onSettings={onSettings}
      />
      {column.children?.length > 0 && (
        <NavChildren
          allNodes={allNodes}
          nodes={column.children}
          depth={1}
          maxLevel={maxLevel}
          pageTypeMap={pageTypeMap}
          onRename={onRename}
          onDelete={onDelete}
          onView={onView}
          onSettings={onSettings}
        />
      )}
    </li>
  );
}
