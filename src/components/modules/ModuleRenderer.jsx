import { Settings, Trash2 } from "lucide-react";

import { MODULE_LABELS } from "@/lib/design/admin-tokens";

import { ButtonsModule } from "./ButtonsModule";
import { CalendarModule } from "./CalendarModule";
import { CarouselModule } from "./CarouselModule";
import { DocumentsModule } from "./DocumentsModule";
import { ImageModule } from "./ImageModule";
import { LinksModule } from "./LinksModule";
import { DailyReadingsModule } from "./DailyReadingsModule";
import { MassTimesModule } from "./MassTimesModule";
import { PeopleModule } from "./PeopleModule";
import { SlideshowModule } from "./SlideshowModule";
import { TextModule } from "./TextModule";
import { VideoModule } from "./VideoModule";
import { ZoomModule } from "./ZoomModule";

const MODULE_MAP = {
  text: TextModule,
  links: LinksModule,
  image: ImageModule,
  gallery: ImageModule,
  slideshow: SlideshowModule,
  carousel: CarouselModule,
  video: VideoModule,
  zoom: ZoomModule,
  mass_times: MassTimesModule,
  daily_readings: DailyReadingsModule,
  documents: DocumentsModule,
  people: PeopleModule,
  buttons: ButtonsModule,
  calendar: CalendarModule,
};

const INLINE_EDIT_TYPES = new Set(["text"]);

export function ModuleRenderer({
  module,
  siteConfig,
  editing = false,
  onEdit,
  onSaveModule,
  onRemove,
}) {
  const Component = MODULE_MAP[module.type] || TextModule;
  const typeLabel = MODULE_LABELS[module.type] || module.type;
  const inlineEditable = INLINE_EDIT_TYPES.has(module.type);

  return (
    <div
      className={`group relative mb-6 ${
        editing
          ? "rounded-lg border-l-4 border-l-[var(--admin-accent)] pl-3 ring-1 ring-transparent transition-shadow hover:ring-primary/20"
          : ""
      }`}
    >
      {editing && (
        <span className="mb-1 inline-block rounded bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {typeLabel}
        </span>
      )}
      {editing && (
        <div className="absolute -right-2 -top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          {!inlineEditable && (
            <button
              type="button"
              onClick={() => onEdit?.(module)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
              aria-label="Edit module"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove?.(module)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
            aria-label="Remove module"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Component
        module={module}
        siteConfig={siteConfig}
        editing={editing}
        onSave={onSaveModule ? (config) => onSaveModule(module.id, config) : undefined}
      />
    </div>
  );
}
