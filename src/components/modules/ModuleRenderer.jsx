"use client";

import dynamic from "next/dynamic";
import { Settings, Trash2 } from "lucide-react";

import { MODULE_LABELS } from "@/lib/design/admin-tokens";

const moduleLoading = () => (
  <div className="mb-6 h-16 animate-pulse rounded-lg bg-muted/60" aria-hidden />
);

const TextModule = dynamic(() => import("./TextModule").then((m) => m.TextModule), {
  loading: moduleLoading,
});
const LinksModule = dynamic(() => import("./LinksModule").then((m) => m.LinksModule), {
  loading: moduleLoading,
});
const ImageModule = dynamic(() => import("./ImageModule").then((m) => m.ImageModule), {
  loading: moduleLoading,
});
const PhotoAlbumsModule = dynamic(
  () => import("./PhotoAlbumsModule").then((m) => m.PhotoAlbumsModule),
  { loading: moduleLoading },
);
const SlideshowModule = dynamic(
  () => import("./SlideshowModule").then((m) => m.SlideshowModule),
  { loading: moduleLoading },
);
const FeatureTilesModule = dynamic(
  () => import("./FeatureTilesModule").then((m) => m.FeatureTilesModule),
  { loading: moduleLoading },
);
const CarouselModule = dynamic(() => import("./CarouselModule").then((m) => m.CarouselModule), {
  loading: moduleLoading,
});
const VideoModule = dynamic(() => import("./VideoModule").then((m) => m.VideoModule), {
  loading: moduleLoading,
});
const ZoomModule = dynamic(() => import("./ZoomModule").then((m) => m.ZoomModule), {
  loading: moduleLoading,
});
const MassTimesModule = dynamic(
  () => import("./MassTimesModule").then((m) => m.MassTimesModule),
  { loading: moduleLoading },
);
const DailyReadingsModule = dynamic(
  () => import("./DailyReadingsModule").then((m) => m.DailyReadingsModule),
  { loading: moduleLoading },
);
const DocumentsModule = dynamic(
  () => import("./DocumentsModule").then((m) => m.DocumentsModule),
  { loading: moduleLoading },
);
const PeopleModule = dynamic(() => import("./PeopleModule").then((m) => m.PeopleModule), {
  loading: moduleLoading,
});
const ButtonsModule = dynamic(() => import("./ButtonsModule").then((m) => m.ButtonsModule), {
  loading: moduleLoading,
});
const CalendarModule = dynamic(
  () => import("./CalendarModule").then((m) => m.CalendarModule),
  { loading: moduleLoading },
);
const FormModule = dynamic(() => import("./FormModule").then((m) => m.FormModule), {
  loading: moduleLoading,
});
const EmbedModule = dynamic(() => import("./EmbedModule").then((m) => m.EmbedModule), {
  loading: moduleLoading,
});
const FacebookEmbedModule = dynamic(
  () => import("./FacebookEmbedModule").then((m) => m.FacebookEmbedModule),
  { loading: moduleLoading },
);
const GoogleMapsModule = dynamic(
  () => import("./GoogleMapsModule").then((m) => m.GoogleMapsModule),
  { loading: moduleLoading },
);
const InstagramEmbedModule = dynamic(
  () => import("./InstagramEmbedModule").then((m) => m.InstagramEmbedModule),
  { loading: moduleLoading },
);
const RssModule = dynamic(() => import("./RssModule").then((m) => m.RssModule), {
  loading: moduleLoading,
});

const MODULE_MAP = {
  text: TextModule,
  links: LinksModule,
  image: ImageModule,
  gallery: ImageModule,
  photo_albums: PhotoAlbumsModule,
  slideshow: SlideshowModule,
  feature_tiles: FeatureTilesModule,
  carousel: CarouselModule,
  video: VideoModule,
  zoom: ZoomModule,
  mass_times: MassTimesModule,
  daily_readings: DailyReadingsModule,
  documents: DocumentsModule,
  people: PeopleModule,
  buttons: ButtonsModule,
  calendar: CalendarModule,
  form: FormModule,
  embed: EmbedModule,
  facebook: FacebookEmbedModule,
  google_maps: GoogleMapsModule,
  instagram: InstagramEmbedModule,
  rss: RssModule,
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
      <div className="site-module">
        <Component
          module={module}
          siteConfig={siteConfig}
          editing={editing}
          onSave={onSaveModule ? (config) => onSaveModule(module.id, config) : undefined}
        />
      </div>
    </div>
  );
}
