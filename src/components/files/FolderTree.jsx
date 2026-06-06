"use client";

export function FolderTree({ folders, selectedId, onSelect, onAddSubfolder }) {
  const roots = folders.filter((f) => !f.parentId);

  return (
    <div className="space-y-1">
      {roots.map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onSelect(folder.id)}
          className={`block w-full rounded px-3 py-2 text-left text-sm ${
            selectedId === folder.id ? "bg-amber-100 font-medium text-amber-900" : "hover:bg-muted"
          }`}
        >
          {folder.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onAddSubfolder}
        className="mt-2 w-full rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50"
      >
        + Subfolder
      </button>
    </div>
  );
}
