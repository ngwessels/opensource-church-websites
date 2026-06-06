"use client";

import { useState } from "react";

import { MassTimesForm } from "@/components/mass-times/MassTimesForm";
import { Button } from "@/components/ui/button";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { normalizeMassTimes } from "@/lib/mass-times/schema";

const overlayZ = { zIndex: ADMIN_Z.overlay };

/**
 * @param {Object} props
 * @param {{ config?: { title?: string, useSiteDefaults?: boolean, times?: unknown } }} props.module
 * @param {{ massTimes?: unknown } | null | undefined} props.siteConfig
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function MassTimesModuleEditor({ module, siteConfig, onSave, onClose }) {
  const siteTimes = normalizeMassTimes(siteConfig?.massTimes || {});
  const hasCustomTimes = module.config?.useSiteDefaults === false;

  const [title, setTitle] = useState(module.config?.title || "Mass Times");
  const [useSiteDefaults, setUseSiteDefaults] = useState(!hasCustomTimes);
  const [times, setTimes] = useState(
    hasCustomTimes
      ? normalizeMassTimes(module.config?.times || siteTimes)
      : siteTimes,
  );

  const handleSave = () => {
    if (useSiteDefaults) {
      onSave({ title, useSiteDefaults: true });
      return;
    }
    onSave({ title, useSiteDefaults: false, times: normalizeMassTimes(times) });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-card shadow-xl">
        <div className="border-b px-4 py-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section title"
            className="w-full text-lg font-semibold outline-none"
          />
        </div>
        <div className="flex-1 overflow-auto p-4">
          <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={useSiteDefaults}
              onChange={(e) => {
                const checked = e.target.checked;
                setUseSiteDefaults(checked);
                if (checked) {
                  setTimes(siteTimes);
                } else if (!module.config?.times) {
                  setTimes(siteTimes);
                }
              }}
              className="rounded border-border"
            />
            Use site-wide mass times
          </label>
          {useSiteDefaults ? (
            <div>
              <p className="mb-3 text-xs text-muted-foreground">
                This module displays mass times from site settings. Uncheck to customize for this
                page only.
              </p>
              <MassTimesForm value={siteTimes} onChange={() => {}} readOnly />
            </div>
          ) : (
            <MassTimesForm value={times} onChange={setTimes} />
          )}
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
