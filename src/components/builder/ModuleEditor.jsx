"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { uploadMediaFile } from "@/lib/media/upload";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

import { ButtonsModuleEditor } from "./ButtonsModuleEditor";
import { CalendarModuleEditor } from "./CalendarModuleEditor";
import { DailyReadingsModuleEditor } from "./DailyReadingsModuleEditor";
import { DocumentsModuleEditor } from "./DocumentsModuleEditor";
import { LinksModuleEditor } from "./LinksModuleEditor";
import { MassTimesModuleEditor } from "./MassTimesModuleEditor";
import { PhotoAlbumsModuleEditor } from "./PhotoAlbumsModuleEditor";
import { PeopleModuleEditor } from "./PeopleModuleEditor";
import { SlideListEditor } from "./SlideListEditor";
import { VideoModuleEditor } from "./VideoModuleEditor";
import { ZoomModuleEditor } from "./ZoomModuleEditor";
import { EmbedModuleEditor } from "./EmbedModuleEditor";

const overlayZ = { zIndex: ADMIN_Z.overlay };

function filenameToAlt(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

export function ModuleEditor({ module, siteConfig, onSave, onClose, pageId }) {
  if (!module) return null;

  if (module.type === "text") {
    return null;
  }

  if (module.type === "image") {
    return <ImageModuleEditor module={module} onSave={onSave} onClose={onClose} pageId={pageId} />;
  }

  if (module.type === "slideshow") {
    return <SlideshowModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "carousel") {
    return <CarouselModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "gallery") {
    return <GalleryModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "photo_albums") {
    return <PhotoAlbumsModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "links") {
    return (
      <LinksModuleEditor module={module} onSave={onSave} onClose={onClose} />
    );
  }

  if (module.type === "buttons") {
    return <ButtonsModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "mass_times") {
    return (
      <MassTimesModuleEditor
        module={module}
        siteConfig={siteConfig}
        onSave={onSave}
        onClose={onClose}
      />
    );
  }

  if (module.type === "calendar") {
    return (
      <CalendarModuleEditor module={module} onSave={onSave} onClose={onClose} />
    );
  }

  if (module.type === "daily_readings") {
    return (
      <DailyReadingsModuleEditor module={module} onSave={onSave} onClose={onClose} />
    );
  }

  if (module.type === "video") {
    return <VideoModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "zoom") {
    return <ZoomModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (["embed", "facebook", "google_maps", "instagram", "rss"].includes(module.type)) {
    return <EmbedModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "people") {
    return <PeopleModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  if (module.type === "documents") {
    return <DocumentsModuleEditor module={module} onSave={onSave} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
        <p className="text-sm text-muted-foreground">Editor for {module.type} coming soon. Use Firestore directly for now.</p>
        <Button type="button" onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    </div>
  );
}

function SlideshowModuleEditor({ module, onSave, onClose }) {
  const dataRef = useRef({ slides: module.config?.slides || [] });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Slideshow</div>
        <div className="flex-1 overflow-auto p-4">
          <SlideListEditor
            slides={module.config?.slides}
            onChange={(data) => {
              dataRef.current = data;
            }}
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSave({ slides: dataRef.current.slides.filter((s) => s.src) })}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function CarouselModuleEditor({ module, onSave, onClose }) {
  const dataRef = useRef({
    slides: module.config?.slides || [],
    title: module.config?.title || "",
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Carousel</div>
        <div className="flex-1 overflow-auto p-4">
          <SlideListEditor
            slides={module.config?.slides}
            title={module.config?.title}
            showTitle
            onChange={(data) => {
              dataRef.current = data;
            }}
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              onSave({
                title: dataRef.current.title,
                slides: dataRef.current.slides.filter((s) => s.src),
              })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageModuleEditor({ module, onSave, onClose }) {
  const [title, setTitle] = useState(module.config?.title || "");
  const [src, setSrc] = useState(module.config?.src || "");
  const [alt, setAlt] = useState(module.config?.alt || "");
  const [caption, setCaption] = useState(module.config?.caption || "");
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const uploadRef = useRef(null);

  const applyMediaFile = (file) => {
    if (file.downloadUrl) setSrc(file.downloadUrl);
    if (file.name) {
      setAlt((current) => (current.trim() ? current : filenameToAlt(file.name)));
    }
    setShowPicker(false);
  };

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;

    setUploading(true);
    const db = getFirebaseFirestore();

    try {
      const record = await uploadMediaFile(
        db,
        fileList[0],
        DEFAULT_MEDIA_FOLDERS.pictures,
        setProgress,
      );
      applyMediaFile(record);
    } finally {
      setUploading(false);
      setProgress(0);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  if (showPicker) {
    return (
      <div className="fixed inset-0 flex flex-col bg-card" style={overlayZ}>
        <MediaPicker
          fullscreen
          title="Choose image"
          onSelect={applyMediaFile}
          onCancel={() => setShowPicker(false)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Image</div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section title (optional)"
          />

          {src && (
            <div className="overflow-hidden rounded border border-border">
              <Image
                src={src}
                alt={alt || title || "Preview"}
                width={400}
                height={250}
                className="h-40 w-full object-cover"
                unoptimized
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setShowPicker(true)}>
              Browse media
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => uploadRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? `Uploading ${progress}%` : "Upload image"}
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          <Input
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder="Image URL"
          />
          <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text" />
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave({ title, src, alt, caption })}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function GalleryModuleEditor({ module, onSave, onClose }) {
  const initialImages = (module.config?.images || []).map((img) => ({
    src: img.src || "",
    alt: img.alt || "",
    caption: img.caption || "",
  }));
  const [form, setForm] = useState({
    images: initialImages.length ? initialImages : [{ src: "", alt: "", caption: "" }],
    title: module.config?.title || "",
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Gallery</div>
        <div className="flex-1 overflow-auto p-4">
          <SlideListEditor
            slides={form.images}
            title={form.title}
            showTitle
            onChange={(data) => setForm({ title: data.title, images: data.slides })}
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              onSave({
                title: form.title,
                images: form.images
                  .filter((s) => s.src)
                  .map((s) => ({ src: s.src, alt: s.alt, caption: s.caption })),
              })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
