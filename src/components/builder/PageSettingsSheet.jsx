"use client";

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
} from "@/lib/pages/layout";
import {
  buildRegionsForColumnCount,
  canReduceColumns,
  clearFeaturesRegion,
  DEFAULT_MAX_MODULES_PER_REGION,
  getMaxModulesPerRegion,
  isHeroSlideshowEnabled,
} from "@/lib/pages/regions";
import {
  buildResponsiveLayoutUpdates,
  normalizeResponsiveLayout,
} from "@/lib/pages/viewports";
import { getPageType } from "@/lib/bulletins/schema";
import {
  getDonationConfig,
} from "@/lib/donations/schema";
import { isHomePage } from "@/lib/pages/visibility";

import { ViewportTabs } from "./ViewportTabs";

function PageSettingsForm({ page, pageTitle, siteName, siteSeo, onClose, onSave, externalError }) {
  const homePage = isHomePage(page);
  const [visibleOnSite, setVisibleOnSite] = useState(page?.hidden !== true);
  const [metaTitle, setMetaTitle] = useState(page?.seo?.title ?? "");
  const [metaDescription, setMetaDescription] = useState(page?.seo?.description ?? "");
  const [pageType, setPageType] = useState(getPageType(page));
  const [layout, setLayout] = useState(page?.layout || "default");
  const initialLayout = normalizeResponsiveLayout(page);
  const [layoutViewport, setLayoutViewport] = useState("desktop");
  const [marginByViewport, setMarginByViewport] = useState(initialLayout.contentMarginXByViewport);
  const [columnsByViewport, setColumnsByViewport] = useState(initialLayout.contentColumnsByViewport);
  const [maxModules, setMaxModules] = useState(getMaxModulesPerRegion(page));
  const [heroSlideshow, setHeroSlideshow] = useState(isHeroSlideshowEnabled(page));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isBulletins = pageType === "bulletins";
  const isDonation = pageType === "donation";
  const hideLayoutSettings = isBulletins || isDonation;

  const handleSave = async () => {
    setError(null);

    if (!hideLayoutSettings) {
      const layoutUpdates = buildResponsiveLayoutUpdates(marginByViewport, columnsByViewport);
      const check = canReduceColumns(page, layoutUpdates.contentColumns);
      if (!check.ok) {
        setError(check.error);
        return;
      }
    }

    setSaving(true);
    try {
      const updates = {
        pageType: homePage ? "content" : pageType,
        hidden: homePage ? false : !visibleOnSite,
        seo: {
          title: metaTitle.trim(),
          description: metaDescription.trim(),
        },
      };

      if (isBulletins) {
        updates.layout = "sidebar-right";
      } else if (isDonation) {
        updates.layout = "default";
        if (getPageType(page) !== "donation") {
          updates.donationConfig = getDonationConfig(page);
        }
      } else {
        const layoutUpdates = buildResponsiveLayoutUpdates(marginByViewport, columnsByViewport);
        let regions = buildRegionsForColumnCount(page, layoutUpdates.contentColumns);
        if (!heroSlideshow) {
          regions = clearFeaturesRegion(regions);
        }
        Object.assign(updates, {
          layout,
          ...layoutUpdates,
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
          <Label>Visible on site</Label>
          <p className="text-xs text-muted-foreground">
            When off, visitors cannot open this page or see it in navigation and footer links.
          </p>
          {homePage ? (
            <p className="text-xs text-muted-foreground">The home page cannot be hidden.</p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibleOnSite(true)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  visibleOnSite
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                On
              </button>
              <button
                type="button"
                onClick={() => setVisibleOnSite(false)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  !visibleOnSite
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Off
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <Label>Search / SEO</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Controls the browser tab title and search engine description for this page.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-title">Meta title</Label>
            <Input
              id="meta-title"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder={pageTitle || page?.title || siteName || "Page title"}
            />
            <p className="text-xs text-muted-foreground">
              Falls back to{" "}
              {[pageTitle || page?.title, siteName].filter(Boolean).join(", then ") || "page title"}
              .
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-description">Meta description</Label>
            <textarea
              id="meta-description"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder={siteSeo?.description || "Site default description"}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              Falls back to the site default description from Admin settings.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Page type</Label>
          <Select
            value={homePage ? "content" : pageType}
            onValueChange={setPageType}
            disabled={homePage}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="content">Content</SelectItem>
              <SelectItem value="bulletins">Bulletins</SelectItem>
              <SelectItem value="donation">Donation</SelectItem>
            </SelectContent>
          </Select>
          {homePage && (
            <p className="text-xs text-muted-foreground">
              The home page must remain a content page.
            </p>
          )}
          {isBulletins && (
            <p className="text-xs text-muted-foreground">
              Upload and manage bulletin PDFs on the page preview.
            </p>
          )}
          {isDonation && (
            <p className="text-xs text-muted-foreground">
              Use the edit button on the donation form to configure funds, amounts, and form text.
            </p>
          )}
        </div>

        {!hideLayoutSettings && (
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

        <div className="space-y-4">
          <ViewportTabs value={layoutViewport} onChange={setLayoutViewport} />

          <div className="space-y-2">
            <Label>Left / right margin</Label>
            <p className="text-xs text-muted-foreground">
              Horizontal spacing for the main content area on{" "}
              {layoutViewport === "desktop"
                ? "desktop (1024px and up)"
                : layoutViewport === "tablet"
                  ? "tablet (768px–1023px)"
                  : "mobile (below 768px)"}
              . Extra large uses at least 6rem or 10% of the screen width, whichever is larger.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONTENT_MARGIN_X_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setMarginByViewport((prev) => ({ ...prev, [layoutViewport]: option.value }))
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    marginByViewport[layoutViewport] === option.value
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
            <p className="text-xs text-muted-foreground">
              Column regions are shared when a viewport uses multiple columns. On single-column
              viewports (typically mobile), module order is edited separately in the builder preview.
            </p>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setColumnsByViewport((prev) => ({ ...prev, [layoutViewport]: n }))
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    columnsByViewport[layoutViewport] === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
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

export function PageSettingsSheet({
  open,
  page,
  pageTitle,
  siteName,
  siteSeo,
  onClose,
  onSave,
  error: externalError,
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Page Settings</SheetTitle>
          <SheetDescription>
            Configure visibility, SEO, page type, layout, and content columns.
          </SheetDescription>
        </SheetHeader>

        {open && page && (
          <PageSettingsForm
            key={page.updatedAt || page.slug}
            page={page}
            pageTitle={pageTitle}
            siteName={siteName}
            siteSeo={siteSeo}
            onClose={onClose}
            onSave={onSave}
            externalError={externalError}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
