"use client";

import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_Z } from "@/lib/design/admin-tokens";

const overlayZ = { zIndex: ADMIN_Z.overlay };

function emptyAlbum() {
  return { label: "", href: "", imageSrc: "", photoCount: "" };
}

export function PhotoAlbumsModuleEditor({ module, onSave, onClose }) {
  const [title, setTitle] = useState(module.config?.title || "");
  const [albums, setAlbums] = useState(() => {
    const saved = module.config?.albums || [];
    return saved.length
      ? saved.map((a) => ({
          label: a.label || "",
          href: a.href || "",
          imageSrc: a.imageSrc || "",
          photoCount: a.photoCount ?? "",
        }))
      : [emptyAlbum()];
  });
  const [pickerIndex, setPickerIndex] = useState(null);

  const updateAlbum = (index, patch) => {
    setAlbums((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      {pickerIndex !== null && (
        <div className="fixed inset-0 flex flex-col bg-card" style={overlayZ}>
          <MediaPicker
            fullscreen
            title="Choose album cover"
            onSelect={(file) => {
              updateAlbum(pickerIndex, { imageSrc: file.downloadUrl || file.url || "" });
              setPickerIndex(null);
            }}
            onCancel={() => setPickerIndex(null)}
          />
        </div>
      )}

      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Photo Albums</div>
        <div className="flex-1 space-y-4 overflow-auto p-4">
          <div>
            <Label htmlFor="photo-albums-title">Section title</Label>
            <Input
              id="photo-albums-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prayer Cards"
              className="mt-1"
            />
          </div>

          {albums.map((album, index) => (
            <div key={index} className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Album {index + 1}</span>
                {albums.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setAlbums((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove album"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {album.imageSrc && (
                <div className="overflow-hidden rounded border border-border">
                  <Image
                    src={album.imageSrc}
                    alt={album.label || "Album cover"}
                    width={320}
                    height={200}
                    className="h-32 w-full object-cover"
                    unoptimized
                  />
                </div>
              )}

              <Input
                value={album.label}
                onChange={(e) => updateAlbum(index, { label: e.target.value })}
                placeholder="Album name"
              />
              <Input
                value={album.href}
                onChange={(e) => updateAlbum(index, { href: e.target.value })}
                placeholder="Link URL (page path or https://…)"
              />
              <Input
                value={album.imageSrc}
                onChange={(e) => updateAlbum(index, { imageSrc: e.target.value })}
                placeholder="Cover image URL"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerIndex(index)}>
                  Browse media
                </Button>
                <Input
                  type="number"
                  min={0}
                  value={album.photoCount}
                  onChange={(e) => updateAlbum(index, { photoCount: e.target.value })}
                  placeholder="Photo count"
                  className="w-28"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAlbums((prev) => [...prev, emptyAlbum()])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add album
          </Button>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              onSave({
                title,
                albums: albums
                  .filter((a) => a.label || a.href || a.imageSrc)
                  .map((a) => ({
                    label: a.label,
                    href: a.href,
                    imageSrc: a.imageSrc,
                    photoCount: a.photoCount === "" ? undefined : Number(a.photoCount) || undefined,
                  })),
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
