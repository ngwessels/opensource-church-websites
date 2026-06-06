"use client";

import { Link2, Play, Trash2 } from "lucide-react";
import Image from "next/image";

import { formatBytes } from "@/lib/media/upload";

export function FileGrid({
  files,
  view = "grid",
  onDelete,
  onEdit,
  selectable = false,
  onSelect,
  selectedId,
}) {
  if (files.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No files in this folder.</p>;
  }

  if (view === "list") {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Name</th>
            <th className="py-2">Description</th>
            <th className="py-2">Size</th>
            {!selectable && <th className="py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.id}
              className={`border-b border-border ${selectable || onEdit ? "cursor-pointer hover:bg-muted" : ""} ${
                selectable && selectedId === file.id ? "bg-primary/10" : ""
              }`}
              onClick={
                selectable ? () => onSelect?.(file) : onEdit ? () => onEdit(file) : undefined
              }
            >
              <td className="py-2">{file.name}</td>
              <td className="max-w-xs truncate py-2 text-muted-foreground">
                {file.description || "—"}
              </td>
              <td className="py-2">{formatBytes(file.sizeBytes)}</td>
              {!selectable && (
                <td className="py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(file.id);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const gridItemClass = (file) =>
    `group relative rounded border bg-card p-2 ${
      selectable || onEdit
        ? `cursor-pointer text-left transition-shadow hover:shadow-md ${
            selectable && selectedId === file.id ? "border-primary ring-2 ring-blue-500" : "border-border"
          }`
        : "border-border"
    }`;

  const gridItemContent = (file) => (
    <>
      {file.usedOnPageIds?.length > 0 && (
        <Link2 className="absolute left-2 top-2 h-4 w-4 text-amber-500" />
      )}
      <div className="aspect-square overflow-hidden rounded bg-muted">
        {file.mimeType?.startsWith("image/") && file.downloadUrl ? (
          <Image
            src={file.downloadUrl}
            alt={file.alt || file.name}
            width={200}
            height={200}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : file.mimeType?.startsWith("video/") ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 bg-zinc-900 text-white">
            <Play className="h-8 w-8 opacity-80" />
            <span className="text-[10px] uppercase tracking-wide opacity-70">Video</span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">DOC</div>
        )}
      </div>
      <p className="mt-2 truncate text-xs font-medium">{file.name}</p>
      {file.description ? (
        <p className="truncate text-xs text-muted-foreground">{file.description}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</p>
      {!selectable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(file.id);
          }}
          className="absolute right-2 top-2 hidden rounded bg-red-600 p-1 text-white group-hover:block"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </>
  );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((file) =>
        selectable ? (
          <button
            key={file.id}
            type="button"
            onClick={() => onSelect?.(file)}
            className={gridItemClass(file)}
          >
            {gridItemContent(file)}
          </button>
        ) : onEdit ? (
          <button
            key={file.id}
            type="button"
            onClick={() => onEdit(file)}
            className={gridItemClass(file)}
          >
            {gridItemContent(file)}
          </button>
        ) : (
          <div key={file.id} className={gridItemClass(file)}>
            {gridItemContent(file)}
          </div>
        ),
      )}
    </div>
  );
}
