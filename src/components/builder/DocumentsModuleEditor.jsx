"use client";

import { ExternalLink, FileText, FolderOpen, Globe, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createEmptyDocumentItem,
  normalizeDocumentItem,
  normalizeDocumentsConfig,
} from "@/lib/documents/schema";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { cn } from "@/lib/utils";

const overlayZ = { zIndex: ADMIN_Z.overlay };

function filenameToLabel(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

export function DocumentsModuleEditor({ module, onSave, onClose }) {
  const initial = normalizeDocumentsConfig(module?.config);
  const [title, setTitle] = useState(initial.title || "Documents");
  const [items, setItems] = useState(() => {
    if (initial.items.length) {
      return initial.items.map((item) => normalizeDocumentItem(item));
    }
    return [createEmptyDocumentItem()];
  });
  const [pickerIndex, setPickerIndex] = useState(null);

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const setSource = (index, source) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (source === "library") {
          return { ...item, source, url: "", mediaId: "" };
        }
        return { ...item, source, mediaId: "" };
      }),
    );
  };

  const removeItem = (index) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyDocumentItem()]);
  };

  const applyMediaFile = (file) => {
    if (pickerIndex === null) return;
    const label =
      items[pickerIndex].label.trim() || filenameToLabel(file.name || "Document");
    updateItem(pickerIndex, {
      label,
      url: file.downloadUrl || "",
      mediaId: file.id || "",
      source: "library",
    });
    setPickerIndex(null);
  };

  const handleSave = () => {
    onSave(normalizeDocumentsConfig({ title, items }, { filterEmpty: true }));
  };

  if (pickerIndex !== null) {
    return (
      <div className="fixed inset-0 flex flex-col bg-card" style={overlayZ}>
        <MediaPicker
          fullscreen
          title="Choose document"
          mediaFilter="documents"
          onSelect={applyMediaFile}
          onCancel={() => setPickerIndex(null)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border bg-muted/80 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Edit documents</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add downloadable files from your library or link to external documents.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="documents-section-title" className="text-muted-foreground">
                Section title
              </Label>
              <Input
                id="documents-section-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Parish documents"
                className="h-9 bg-card"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-5">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Document {i + 1}
                </span>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => removeItem(i)}
                    className="h-7 gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`document-label-${i}`}>Display label</Label>
                  <Input
                    id={`document-label-${i}`}
                    value={item.label}
                    onChange={(e) => updateItem(i, { label: e.target.value })}
                    placeholder="e.g. Parish bulletin archive"
                  />
                </div>

                <div className="space-y-2">
                  <Label>File source</Label>
                  <Tabs
                    value={item.source}
                    onValueChange={(value) => setSource(i, value)}
                    className="gap-3"
                  >
                    <TabsList className="grid h-9 w-full grid-cols-2">
                      <TabsTrigger value="library" className="gap-1.5 text-xs sm:text-sm">
                        <FolderOpen className="size-3.5" />
                        File library
                      </TabsTrigger>
                      <TabsTrigger value="external" className="gap-1.5 text-xs sm:text-sm">
                        <Globe className="size-3.5" />
                        External URL
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="library" className="mt-0 space-y-2">
                      {item.url && item.source === "library" ? (
                        <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
                          <p className="text-sm font-medium text-foreground">{item.label || "Selected file"}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{item.url}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setPickerIndex(i)}
                          >
                            Change file
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-dashed"
                          onClick={() => setPickerIndex(i)}
                        >
                          <FolderOpen className="size-4" />
                          Choose from file library
                        </Button>
                      )}
                    </TabsContent>

                    <TabsContent value="external" className="mt-0 space-y-2">
                      <div className="relative">
                        <ExternalLink className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={item.url}
                          onChange={(e) =>
                            updateItem(i, { url: e.target.value, mediaId: "", source: "external" })
                          }
                          placeholder="https://drive.google.com/..."
                          className="pl-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Link to a file hosted elsewhere, such as Google Drive or Dropbox.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            className={cn("w-full border-dashed", items.length > 0 && "mt-1")}
          >
            <Plus className="size-4" />
            Add document
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-muted/50 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
