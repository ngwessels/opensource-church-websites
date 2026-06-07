"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { ModuleRenderer } from "@/components/modules/ModuleRenderer";
import { DonationRegionContent } from "@/components/donations/DonationRegionContent";
import { getRegionLabel, getRegionModules, isFeaturesModuleType } from "@/lib/pages/regions";

import { InsertSlot } from "./InsertSlot";
import { SortableModule } from "./SortableModule";

export function RegionColumn({
  regionId,
  page,
  siteConfig,
  editing,
  onEditModule,
  onSaveModule,
  onRemoveModule,
  isDragActive,
  dragType,
  className,
  columnCount,
  donationReturnPath = null,
  onEditDonation,
}) {
  const modules = getRegionModules(page, regionId);
  const label = getRegionLabel(regionId, columnCount);

  const { setNodeRef, isOver } = useDroppable({
    id: `region-end-${regionId}`,
    data: { kind: "region-end", regionId, index: modules.length },
  });

  const showHighlight =
    isDragActive && dragType && !isFeaturesModuleType(dragType) && regionId !== "features";
  const highlightClass = isOver ? "is-over" : showHighlight ? "is-drag-active" : "";

  const showDonationForm = donationReturnPath && regionId === "content-1";

  if (!editing) {
    return (
      <div className={className}>
        {modules.map((mod) => (
          <ModuleRenderer
            key={mod.id}
            module={mod}
            siteConfig={siteConfig}
            editing={false}
          />
        ))}
        {showDonationForm && (
          <DonationRegionContent
            page={page}
            returnPath={donationReturnPath}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`edit-region-drop min-h-[120px] rounded-lg p-3 ${highlightClass} ${editing ? "is-editing" : ""} ${className || ""}`}
    >
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <InsertSlot regionId={regionId} index={0} isDragActive={isDragActive} />
        {modules.map((mod, i) => (
          <div key={mod.id}>
            <SortableModule
              module={mod}
              regionId={regionId}
              siteConfig={siteConfig}
              editing={editing}
              onEditModule={onEditModule}
              onSaveModule={onSaveModule}
              onRemoveModule={onRemoveModule}
            />
            <InsertSlot regionId={regionId} index={i + 1} isDragActive={isDragActive} />
          </div>
        ))}
      </SortableContext>

      {modules.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Drop modules here</p>
      )}

        {showDonationForm && (
          <DonationRegionContent
            page={page}
            returnPath={donationReturnPath}
            editing
            onEdit={onEditDonation}
          />
        )}
    </div>
  );
}
