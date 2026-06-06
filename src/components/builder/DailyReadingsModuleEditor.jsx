"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { normalizeDailyReadingsConfig } from "@/lib/readings/schema";

const overlayZ = { zIndex: ADMIN_Z.overlay };

/**
 * @param {Object} props
 * @param {{ config?: import('@/lib/readings/schema').DailyReadingsModuleConfig }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function DailyReadingsModuleEditor({ module, onSave, onClose }) {
  const initial = normalizeDailyReadingsConfig(module?.config);

  const [title, setTitle] = useState(initial.title || "Daily Readings");
  const [showUsccbLink, setShowUsccbLink] = useState(initial.showUsccbLink !== false);

  const handleSave = () => {
    onSave(
      normalizeDailyReadingsConfig({
        title,
        showUsccbLink,
      }),
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3 font-semibold">Daily Readings</div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          <p className="text-xs text-muted-foreground">
            Displays today&apos;s Mass readings from the U.S. Lectionary (New American Bible). Readings
            update automatically each day.
          </p>

          <div className="space-y-2">
            <Label htmlFor="daily-readings-title">Section title</Label>
            <Input
              id="daily-readings-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Daily Readings"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showUsccbLink}
              onChange={(e) => setShowUsccbLink(e.target.checked)}
              className="rounded border-border"
            />
            Show link to official USCCB readings page
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
