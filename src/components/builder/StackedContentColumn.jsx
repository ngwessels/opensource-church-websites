"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { ModuleRenderer } from "@/components/modules/ModuleRenderer";
import { DonationRegionContent } from "@/components/donations/DonationRegionContent";
import { CONTENT_STACK_REGION_ID, getStackedContentModules } from "@/lib/pages/stack-layout";
import { isFeaturesModuleType } from "@/lib/pages/regions";

import { InsertSlot } from "./InsertSlot";
import { SortableModule } from "./SortableModule";

export function StackedContentColumn({
  page,
  siteConfig,
  calendarEventsByModuleId = null,
  previewViewport,
  editing,
  onEditModule,
  onSaveModule,
  onRemoveModule,
  isDragActive,
  dragType,
  className,
  donationReturnPath = null,
  onEditDonation,
}) {
  const modules = getStackedContentModules(page, previewViewport);
  const regionId = CONTENT_STACK_REGION_ID;

  const { setNodeRef, isOver } = useDroppable({
    id: `region-end-${regionId}`,
    data: { kind: "region-end", regionId, index: modules.length },
  });

  const showHighlight =
    isDragActive && dragType && !isFeaturesModuleType(dragType);
  const highlightClass = isOver ? "is-over" : showHighlight ? "is-drag-active" : "";

  if (!editing) {
    return (
      <div className={className}>
        {modules.map((mod) => (
          <ModuleRenderer
            key={mod.id}
            module={mod}
            siteConfig={siteConfig}
            calendarEvents={calendarEventsByModuleId?.[mod.id]}
            editing={false}
          />
        ))}
        {donationReturnPath && (
          <DonationRegionContent page={page} returnPath={donationReturnPath} />
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`edit-region-drop min-h-[120px] rounded-lg p-3 ${highlightClass} is-editing ${className || ""}`}
    >
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Content
      </p>

      <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <InsertSlot regionId={regionId} index={0} isDragActive={isDragActive} />
        {modules.map((mod, i) => (
          <div key={mod.id}>
            <SortableModule
              module={mod}
              regionId={regionId}
              siteConfig={siteConfig}
              calendarEventsByModuleId={calendarEventsByModuleId}
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

      {donationReturnPath && (
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
