"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CONTENT_MARGIN_X_OPTIONS,
  DEFAULT_CONTENT_MARGIN_X,
  getContentMarginX,
} from "@/lib/pages/layout";
import {
  buildRegionsForColumnCount,
  canReduceColumns,
  clearFeaturesRegion,
  DEFAULT_MAX_MODULES_PER_REGION,
  getContentColumnCount,
  getMaxModulesPerRegion,
  isHeroSlideshowEnabled,
} from "@/lib/pages/regions";
import { getPageType } from "@/lib/bulletins/schema";

function PageSettingsForm({ page, onClose, onSave, externalError }) {
  const [pageType, setPageType] = useState(getPageType(page));
  const [layout, setLayout] = useState(page?.layout || "default");
  const [contentMarginX, setContentMarginX] = useState(getContentMarginX(page));
  const [contentColumns, setContentColumns] = useState(getContentColumnCount(page));
  const [maxModules, setMaxModules] = useState(getMaxModulesPerRegion(page));
  const [heroSlideshow, setHeroSlideshow] = useState(isHeroSlideshowEnabled(page));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isBulletins = pageType === "bulletins";

  const handleSave = async () => {
    setError(null);

    if (!isBulletins) {
      const check = canReduceColumns(page, contentColumns);
      if (!check.ok) {
        setError(check.error);
        return;
      }
    }

    setSaving(true);
    try {
      const updates = { pageType };

      if (isBulletins) {
        updates.layout = "sidebar-right";
      } else {
        let regions = buildRegionsForColumnCount(page, contentColumns);
        if (!heroSlideshow) {
          regions = clearFeaturesRegion(regions);
        }
        Object.assign(updates, {
          layout,
          contentMarginX: contentMarginX || DEFAULT_CONTENT_MARGIN_X,
          contentColumns,
          maxModulesPerRegion: maxModules || DEFAULT_MAX_MODULES_PER_REGION,
          heroSlideshowEnabled: heroSlideshow,
          regions,
        });
      }

      await onSave(updates);
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save page settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <Label>Page type</Label>
          <Select value={pageType} onValueChange={setPageType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="content">Content</SelectItem>
              <SelectItem value="bulletins">Bulletins</SelectItem>
            </SelectContent>
          </Select>
          {isBulletins && (
            <p className="text-xs text-muted-foreground">
              Upload and manage bulletin PDFs in the{" "}
              <Link href="/builder/bulletins" className="text-primary underline">
                Bulletins tab
              </Link>
              .
            </p>
          )}
        </div>

        {!isBulletins && (
        <>
        <div className="space-y-2">
          <Label>Page layout</Label>
          <Select value={layout} onValueChange={setLayout}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (centered)</SelectItem>
              <SelectItem value="full-width">Full width</SelectItem>
              <SelectItem value="sidebar-left">Sidebar left</SelectItem>
              <SelectItem value="sidebar-right">Sidebar right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Left / right margin</Label>
          <p className="text-xs text-muted-foreground">
            Horizontal spacing for the main content area. Extra large uses at least 6rem or 10% of
            the screen width, whichever is larger.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CONTENT_MARGIN_X_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setContentMarginX(option.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  contentMarginX === option.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Content columns</Label>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setContentColumns(n)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  contentColumns === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Hero slideshow</Label>
          <p className="text-xs text-muted-foreground">
            When on, drag Slideshow from the Content Library onto the features area above your content.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHeroSlideshow(false)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                !heroSlideshow
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              Off
            </button>
            <button
              type="button"
              onClick={() => setHeroSlideshow(true)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                heroSlideshow
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              On
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-modules">Max modules per column</Label>
          <Input
            id="max-modules"
            type="number"
            min={1}
            max={50}
            value={maxModules}
            onChange={(e) => setMaxModules(Number(e.target.value))}
          />
        </div>
        </>
        )}

        {(error || externalError) && (
          <p className="text-sm text-red-600">{error || externalError}</p>
        )}
      </div>

      <SheetFooter className="mt-8">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}

export function PageSettingsSheet({ open, page, onClose, onSave, error: externalError }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Page Settings</SheetTitle>
          <SheetDescription>Configure page type, layout, and content columns.</SheetDescription>
        </SheetHeader>

        {open && page && (
          <PageSettingsForm
            key={page.updatedAt || page.slug}
            page={page}
            onClose={onClose}
            onSave={onSave}
            externalError={externalError}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
