"use client";

import { doc, updateDoc } from "firebase/firestore";
import { PaletteIcon, TypeIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { PreviewFrame } from "@/components/builder/PreviewFrame";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendDesignPreview, useDesignPreviewSender } from "@/hooks/useDesignPreviewBridge";
import { designEquals, normalizeDesign } from "@/lib/design/design-utils";
import { getThemeById } from "@/lib/design/themes";
import { DEFAULT_HEADER_STYLES } from "@/lib/site/header-styles";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

import { ColorFontEditor } from "./ColorFontEditor";
import { ThemeGallery } from "./ThemeGallery";

export function DesignPanel({ siteConfig }) {
  const [tab, setTab] = useState("themes");
  const [device, setDevice] = useState("desktop");
  const [design, setDesign] = useState(() => {
    const published = siteConfig?.design || {};
    return normalizeDesign(published, getThemeById(published.themeId));
  });
  const [headerStyles, setHeaderStyles] = useState(() => ({
    ...DEFAULT_HEADER_STYLES,
    ...siteConfig?.headerConfig?.styles,
  }));
  const [saving, setSaving] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const iframeRef = useRef(null);

  const preview = useMemo(
    () => ({ design, headerStyles }),
    [design, headerStyles],
  );

  const hasChanges = useMemo(
    () =>
      !designEquals(
        siteConfig?.design,
        design,
        siteConfig?.headerConfig?.styles,
        headerStyles,
      ),
    [siteConfig?.design, siteConfig?.headerConfig?.styles, design, headerStyles],
  );

  useDesignPreviewSender(iframeRef, preview);

  const updateDesign = (partial) => {
    setPublishMessage("");
    setDesign((prev) => ({ ...prev, ...partial }));
  };

  const handleThemeSelect = (selectedTheme) => {
    updateDesign({
      themeId: selectedTheme.id,
      colors: { ...selectedTheme.colors },
      fonts: { ...selectedTheme.fonts },
      layout: { ...selectedTheme.layout },
    });
  };

  const handlePublish = async () => {
    setSaving(true);
    setPublishMessage("");
    try {
      const db = getFirebaseFirestore();
      const headerLayout = design.layout?.header;
      const patch = {
        design,
        updatedAt: new Date().toISOString(),
      };
      patch.headerConfig = {
        ...siteConfig?.headerConfig,
        ...(headerLayout ? { layout: headerLayout } : {}),
        styles: {
          ...siteConfig?.headerConfig?.styles,
          ...headerStyles,
        },
      };
      await updateDoc(doc(db, COLLECTIONS.site, SITE_CONFIG_ID), patch);
      setPublishMessage("Design published successfully.");
    } catch {
      setPublishMessage("Failed to publish. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <Card className="flex w-96 shrink-0 flex-col overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Design</CardTitle>
            <CardDescription>Theme, colors, and typography</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto pt-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList variant="line" className="mb-4 w-full">
                <TabsTrigger value="themes" className="flex-1 gap-1.5">
                  <PaletteIcon className="size-3.5" />
                  Themes
                </TabsTrigger>
                <TabsTrigger value="colors" className="flex-1 gap-1.5">
                  <TypeIcon className="size-3.5" />
                  Colors & Fonts
                </TabsTrigger>
              </TabsList>
              <TabsContent value="themes">
                <ThemeGallery selectedId={design.themeId} onSelect={handleThemeSelect} />
              </TabsContent>
              <TabsContent value="colors">
                <ColorFontEditor
                  design={design}
                  headerStyles={headerStyles}
                  onChange={updateDesign}
                  onHeaderStylesChange={setHeaderStyles}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="flex-1 overflow-hidden rounded-lg border bg-card shadow-sm">
          <PreviewFrame
            ref={iframeRef}
            src="/"
            device={device}
            onLoad={() => sendDesignPreview(iframeRef, preview)}
          />
        </div>
      </div>
      <div
        className="flex items-center justify-between border-t bg-card px-4 shadow-sm"
        style={{ height: "var(--admin-page-nav-height)" }}
      >
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {["desktop", "tablet", "mobile"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={`rounded-md px-4 py-1.5 text-sm capitalize ${
                  device === d
                    ? "admin-tab-active bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
          )}
          {publishMessage && (
            <span
              className={`text-xs ${
                publishMessage.includes("success")
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive"
              }`}
            >
              {publishMessage}
            </span>
          )}
        </div>
        <Button onClick={handlePublish} disabled={saving || !hasChanges}>
          {saving ? "Publishing…" : "Publish Design"}
        </Button>
      </div>
    </div>
  );
}
