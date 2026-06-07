"use client";

import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_Z } from "@/lib/design/admin-tokens";

const overlayZ = { zIndex: ADMIN_Z.overlay };

const EMPTY_ITEM = { label: "", href: "/", imageSrc: "" };

export function FeatureTilesModuleEditor({ module, onSave, onClose }) {
  const [items, setItems] = useState(
    module.config?.items?.length ? module.config.items : [{ ...EMPTY_ITEM }, { ...EMPTY_ITEM }, { ...EMPTY_ITEM }, { ...EMPTY_ITEM }],
  );

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  };

  const removeItem = (index) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Feature Tiles</div>
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {items.map((item, i) => (
            <div key={i} className="space-y-2 rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tile {i + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label="Remove tile"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {item.imageSrc && (
                <div className="overflow-hidden rounded border border-border">
                  <Image
                    src={item.imageSrc}
                    alt={item.label || `Tile ${i + 1}`}
                    width={200}
                    height={260}
                    className="h-32 w-full object-cover"
                    unoptimized
                  />
                </div>
              )}
              <Input
                value={item.label || ""}
                onChange={(e) => updateItem(i, "label", e.target.value)}
                placeholder="Label"
              />
              <Input
                value={item.href || ""}
                onChange={(e) => updateItem(i, "href", e.target.value)}
                placeholder="Link URL (e.g. /about)"
              />
              <Input
                value={item.imageSrc || ""}
                onChange={(e) => updateItem(i, "imageSrc", e.target.value)}
                placeholder="Image URL"
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add tile
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
                items: items.filter((item) => item.label?.trim() || item.imageSrc?.trim()),
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
