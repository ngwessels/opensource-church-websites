"use client";

import { useDroppable } from "@dnd-kit/core";
import { Pencil, Trash2 } from "lucide-react";

import { HeroSlideshow } from "./HeroSlideshow";
import {
  FEATURES_REGION_ID,
  getRegionModules,
  hasFeaturesSlideshow,
  isHeroSlideshowEnabled,
} from "@/lib/pages/regions";

export function DroppableFeatures({
  page,
  editing,
  trayOpen = false,
  isDragActive,
  dragType,
  onRemoveSlideshow,
  onEditSlideshow,
}) {
  const modules = getRegionModules(page, FEATURES_REGION_ID);
  const slideshow = modules[0];
  const draggingSlideshow = isDragActive && dragType === "slideshow";
  const showDropTarget =
    editing && !slideshow && isHeroSlideshowEnabled(page) && (trayOpen || draggingSlideshow);

  const { setNodeRef, isOver } = useDroppable({
    id: "region-features",
    data: { kind: "features", regionId: FEATURES_REGION_ID },
    disabled: !showDropTarget,
  });

  if (!editing && !slideshow) return null;
  if (!slideshow && !isHeroSlideshowEnabled(page)) return null;
  if (!slideshow && !showDropTarget) return null;

  if (showDropTarget) {
    const highlightClass = isOver || draggingSlideshow ? "is-over" : "is-drag-active";
    return (
      <div
        ref={setNodeRef}
        className={`edit-region-drop edit-region-features ${highlightClass} is-editing`}
      >
        <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Features Slideshow
        </p>
        <div
          className={`flex items-center justify-center border-2 border-dashed text-sm transition-colors ${
            isOver || draggingSlideshow
              ? "h-32 border-primary/60 bg-primary/10 text-foreground"
              : "h-24 border-border bg-muted/80 text-muted-foreground"
          }`}
        >
          {draggingSlideshow ? "Drop slideshow here" : "Drag Slideshow from Content Library"}
        </div>
      </div>
    );
  }

  return (
    <div className="edit-region-features group relative">
      {editing && slideshow && (
        <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEditSlideshow?.(slideshow)}
            className="flex items-center gap-1 rounded-md bg-primary/90 px-2.5 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur-sm hover:bg-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onRemoveSlideshow?.(slideshow)}
            className="flex items-center gap-1 rounded-md bg-red-600/90 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      )}
      <HeroSlideshow module={slideshow} editing={editing} />
    </div>
  );
}

export { hasFeaturesSlideshow };
