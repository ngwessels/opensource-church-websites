"use client";

import { useDroppable } from "@dnd-kit/core";
import { Pencil, Trash2 } from "lucide-react";

import { FeatureTilesModule } from "@/components/modules/FeatureTilesModule";
import { HeroSlideshow } from "./HeroSlideshow";
import {
  FEATURES_REGION_ID,
  getRegionModules,
  isFeaturesModuleType,
  isHeroSlideshowEnabled,
} from "@/lib/pages/regions";

export function DroppableFeatures({
  page,
  editing,
  trayOpen = false,
  isDragActive,
  dragType,
  heroCaptionVariant = "bottomGradient",
  previewViewport = null,
  onRemoveSlideshow,
  onEditSlideshow,
}) {
  const modules = getRegionModules(page, FEATURES_REGION_ID);
  const featureModule = modules[0];
  const draggingFeatures = isDragActive && isFeaturesModuleType(dragType);
  const showDropTarget =
    editing &&
    !featureModule &&
    isHeroSlideshowEnabled(page) &&
    (trayOpen || draggingFeatures);

  const { setNodeRef, isOver } = useDroppable({
    id: "region-features",
    data: { kind: "features", regionId: FEATURES_REGION_ID },
    disabled: !showDropTarget,
  });

  if (!editing && !featureModule) return null;
  if (!featureModule && !isHeroSlideshowEnabled(page)) return null;
  if (!featureModule && !showDropTarget) return null;

  if (showDropTarget) {
    const highlightClass = isOver || draggingFeatures ? "is-over" : "is-drag-active";
    return (
      <div
        ref={setNodeRef}
        className={`edit-region-drop edit-region-features ${highlightClass} is-editing`}
      >
        <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Features
        </p>
        <div
          className={`flex items-center justify-center border-2 border-dashed text-sm transition-colors ${
            isOver || draggingFeatures
              ? "h-32 border-primary/60 bg-primary/10 text-foreground"
              : "h-24 border-border bg-muted/80 text-muted-foreground"
          }`}
        >
          {draggingFeatures ? "Drop module here" : "Drag Slideshow or Feature Tiles from Content Library"}
        </div>
      </div>
    );
  }

  return (
    <div className="edit-region-features group relative">
      {editing && featureModule && (
        <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEditSlideshow?.(featureModule)}
            className="flex items-center gap-1 rounded-md bg-primary/90 px-2.5 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur-sm hover:bg-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onRemoveSlideshow?.(featureModule)}
            className="flex items-center gap-1 rounded-md bg-red-600/90 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      )}
      {featureModule.type === "feature_tiles" ? (
        <FeatureTilesModule module={featureModule} editing={editing} />
      ) : (
        <HeroSlideshow
          module={featureModule}
          editing={editing}
          captionLayout={heroCaptionVariant}
          previewViewport={previewViewport}
        />
      )}
    </div>
  );
}

export { hasFeaturesSlideshow } from "@/lib/pages/regions";
