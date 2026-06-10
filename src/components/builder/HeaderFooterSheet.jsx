"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

import { FontField } from "@/components/design/FontField";
import { useAuth } from "@/hooks/useAuth";
import { requestPublicRevalidate } from "@/lib/cache/revalidate-client";
import { Button } from "@/components/ui/button";
import { ColorInput } from "@/components/ui/color-input";
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
import { persistNavNodeChanges } from "@/lib/firestore/nav-nodes";
import { DEFAULT_FOOTER_STYLES } from "@/lib/site/footer-styles";
import { DEFAULT_HEADER_STYLES } from "@/lib/site/header-styles";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { applyQuickLinksDraft, quickLinksToDraftItems } from "@/lib/sitemap/tree";

import { HeaderQuickLinksEditor } from "./HeaderQuickLinksEditor";
import { SocialMediaEditor } from "./SocialMediaEditor";
import { DEFAULT_SOCIAL_MEDIA, sanitizeSocialMediaConfig } from "@/lib/site/social-media";

function ColorField({ label, value, onChange, placeholder }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <ColorInput value={value} fallback={placeholder} onChange={onChange} />
      <Input
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
    </label>
  );
}

function HeaderStylesEditor({ styles, designColors, designFonts, onChange, focus }) {
  const titleColorsRef = useRef(null);
  const navColorsRef = useRef(null);

  useEffect(() => {
    if (focus === "title") {
      titleColorsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (focus === "nav") {
      navColorsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus]);

  const updateStyle = (key, value) => {
    onChange({ ...styles, [key]: value });
  };

  return (
    <div className="space-y-6 border-t pt-4">
      <div>
        <h4 className="mb-3 text-sm font-semibold">Background colors</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Leave blank to use site theme colors (primary for header, secondary for navigation).
        </p>
        <div className="space-y-3">
          <ColorField
            label="Header bar"
            value={styles.headerBackground}
            placeholder={designColors.primary || "#7f1d1d"}
            onChange={(v) => updateStyle("headerBackground", v)}
          />
          <ColorField
            label="Navigation bar"
            value={styles.navBackground}
            placeholder={designColors.secondary || "#1e3a5f"}
            onChange={(v) => updateStyle("navBackground", v)}
          />
        </div>
      </div>

      <div ref={titleColorsRef}>
        <h4 className="mb-3 text-sm font-semibold">Title area text</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Colors for the parish name and tagline above the navigation bar.
        </p>
        <div className="space-y-3">
          <ColorField
            label="Title"
            value={styles.titleColor}
            placeholder="#ffffff"
            onChange={(v) => updateStyle("titleColor", v)}
          />
          <ColorField
            label="Tagline"
            value={styles.taglineColor}
            placeholder="rgba(255, 255, 255, 0.9)"
            onChange={(v) => updateStyle("taglineColor", v)}
          />
        </div>
      </div>

      <div ref={navColorsRef}>
        <h4 className="mb-3 text-sm font-semibold">Navigation text</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Color for menu links such as Home and About. Independent from the title area.
        </p>
        <div className="space-y-3">
          <ColorField
            label="Navigation"
            value={styles.navTextColor}
            placeholder="#ffffff"
            onChange={(v) => updateStyle("navTextColor", v)}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold">Fonts</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Leave blank to use site theme fonts from the Design panel.
        </p>
        <div className="space-y-3">
          <FontField
            id="titleFont"
            label="Title font"
            value={styles.titleFont || ""}
            allowDefault
            defaultLabel={`Theme default (${designFonts?.heading || "Georgia, serif"})`}
            onChange={(v) => updateStyle("titleFont", v)}
          />
          <FontField
            id="taglineFont"
            label="Tagline font"
            value={styles.taglineFont || ""}
            allowDefault
            defaultLabel={`Theme default (${designFonts?.body || "Arial, sans-serif"})`}
            onChange={(v) => updateStyle("taglineFont", v)}
          />
          <FontField
            id="navFont"
            label="Navigation font"
            value={styles.navFont || ""}
            allowDefault
            defaultLabel={`Theme default (${designFonts?.body || "Arial, sans-serif"})`}
            onChange={(v) => updateStyle("navFont", v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Title weight</Label>
              <Select
                value={styles.titleFontWeight || "700"}
                onValueChange={(v) => updateStyle("titleFontWeight", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">Regular</SelectItem>
                  <SelectItem value="500">Medium</SelectItem>
                  <SelectItem value="600">Semibold</SelectItem>
                  <SelectItem value="700">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="titleFontSize">Title size</Label>
              <Input
                id="titleFontSize"
                value={styles.titleFontSize || ""}
                placeholder="2.25rem"
                onChange={(e) => updateStyle("titleFontSize", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="navFontSize">Navigation size</Label>
            <Input
              id="navFontSize"
              value={styles.navFontSize || ""}
              placeholder="0.875rem"
              onChange={(e) => updateStyle("navFontSize", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterStylesEditor({ styles, designColors, designFonts, onChange }) {
  const updateStyle = (key, value) => {
    onChange({ ...styles, [key]: value });
  };

  return (
    <div className="space-y-6 border-t pt-4">
      <div>
        <h4 className="mb-3 text-sm font-semibold">Background</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Leave blank to use the theme footer style (e.g. dark band uses secondary color).
        </p>
        <ColorField
          label="Footer bar"
          value={styles.footerBackground}
          placeholder={designColors.secondary || "#1e3a5f"}
          onChange={(v) => updateStyle("footerBackground", v)}
        />
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold">Text colors</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Leave blank to use theme defaults. Dark footers default to light text.
        </p>
        <div className="space-y-3">
          <ColorField
            label="Column titles"
            value={styles.headingColor}
            placeholder="Theme default"
            onChange={(v) => updateStyle("headingColor", v)}
          />
          <ColorField
            label="Body text"
            value={styles.textColor}
            placeholder="Theme default"
            onChange={(v) => updateStyle("textColor", v)}
          />
          <ColorField
            label="Links"
            value={styles.linkColor}
            placeholder="Theme default"
            onChange={(v) => updateStyle("linkColor", v)}
          />
          <ColorField
            label="Copyright"
            value={styles.copyrightColor}
            placeholder="Theme default"
            onChange={(v) => updateStyle("copyrightColor", v)}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold">Fonts</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Leave blank to use site theme fonts from the Design panel.
        </p>
        <div className="space-y-3">
          <FontField
            id="footerHeadingFont"
            label="Column title font"
            value={styles.headingFont || ""}
            allowDefault
            defaultLabel={`Theme default (${designFonts?.heading || "Georgia, serif"})`}
            onChange={(v) => updateStyle("headingFont", v)}
          />
          <FontField
            id="footerBodyFont"
            label="Body text font"
            value={styles.bodyFont || ""}
            allowDefault
            defaultLabel={`Theme default (${designFonts?.body || "Arial, sans-serif"})`}
            onChange={(v) => updateStyle("bodyFont", v)}
          />
          <FontField
            id="footerLinkFont"
            label="Link font"
            value={styles.linkFont || ""}
            allowDefault
            defaultLabel={`Theme default (${designFonts?.body || "Arial, sans-serif"})`}
            onChange={(v) => updateStyle("linkFont", v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Title weight</Label>
              <Select
                value={styles.headingFontWeight || "600"}
                onValueChange={(v) => updateStyle("headingFontWeight", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">Regular</SelectItem>
                  <SelectItem value="500">Medium</SelectItem>
                  <SelectItem value="600">Semibold</SelectItem>
                  <SelectItem value="700">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="footerHeadingFontSize">Title size</Label>
              <Input
                id="footerHeadingFontSize"
                value={styles.headingFontSize || ""}
                placeholder="0.875rem"
                onChange={(e) => updateStyle("headingFontSize", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerBodyFontSize">Body text size</Label>
            <Input
              id="footerBodyFontSize"
              value={styles.bodyFontSize || ""}
              placeholder="0.875rem"
              onChange={(e) => updateStyle("bodyFontSize", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerLinkFontSize">Link size</Label>
            <Input
              id="footerLinkFontSize"
              value={styles.linkFontSize || ""}
              placeholder="0.875rem"
              onChange={(e) => updateStyle("linkFontSize", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerCopyrightFontSize">Copyright size</Label>
            <Input
              id="footerCopyrightFontSize"
              value={styles.copyrightFontSize || ""}
              placeholder="0.875rem"
              onChange={(e) => updateStyle("copyrightFontSize", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeaderFooterSheet({
  open,
  section,
  focus,
  siteConfig,
  navNodes = [],
  onClose,
  onSaved,
}) {
  const { user } = useAuth();
  const isHeader = section === "header";
  const [saving, setSaving] = useState(false);
  const [siteName, setSiteName] = useState(siteConfig?.name || "");
  const [tagline, setTagline] = useState(siteConfig?.tagline || "");
  const [quickLinkItems, setQuickLinkItems] = useState([]);
  const quickLinksInitialized = useRef(false);

  useEffect(() => {
    if (!open) {
      quickLinksInitialized.current = false;
      return;
    }
    if (!isHeader || quickLinksInitialized.current) return;
    quickLinksInitialized.current = true;
    setQuickLinkItems(quickLinksToDraftItems(navNodes));
  }, [open, isHeader, navNodes]);

  const [headerConfig, setHeaderConfig] = useState(() => ({
    showTagline: true,
    showLogo: false,
    logoUrl: "",
    layout: "centered",
    ...siteConfig?.headerConfig,
    styles: {
      ...DEFAULT_HEADER_STYLES,
      ...siteConfig?.headerConfig?.styles,
    },
  }));
  const [footerConfig, setFooterConfig] = useState(() => ({
    text: "",
    columns: [],
    ...siteConfig?.footerConfig,
    styles: {
      ...DEFAULT_FOOTER_STYLES,
      ...siteConfig?.footerConfig?.styles,
    },
  }));
  const [socialMedia, setSocialMedia] = useState(() => ({
    ...DEFAULT_SOCIAL_MEDIA,
    ...siteConfig?.socialMedia,
  }));

  useEffect(() => {
    if (!open) return;
    if (isHeader) {
      setSiteName(siteConfig?.name || "");
      setTagline(siteConfig?.tagline || "");
      setHeaderConfig({
        showTagline: true,
        showLogo: false,
        logoUrl: "",
        layout: "centered",
        ...siteConfig?.headerConfig,
        styles: {
          ...DEFAULT_HEADER_STYLES,
          ...siteConfig?.headerConfig?.styles,
        },
      });
      setSocialMedia({
        ...DEFAULT_SOCIAL_MEDIA,
        ...siteConfig?.socialMedia,
      });
    } else {
      setFooterConfig({
        text: "",
        columns: [],
        ...siteConfig?.footerConfig,
        styles: {
          ...DEFAULT_FOOTER_STYLES,
          ...siteConfig?.footerConfig?.styles,
        },
      });
    }
  }, [open, isHeader, siteConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      const now = new Date().toISOString();

      if (isHeader) {
        const validQuickLinks = quickLinkItems.filter((item) => {
          if (!item.title?.trim()) return false;
          if (item.source === "site") return !!item.targetNodeId;
          return !!item.externalUrl?.trim();
        });
        const updatedNodes = applyQuickLinksDraft(navNodes, validQuickLinks);
        if (validQuickLinks.length > 0 || navNodes.some((n) => n.isQuickLink)) {
          await persistNavNodeChanges(db, navNodes, updatedNodes);
        }
      }

      const patch = isHeader
        ? {
            name: siteName,
            tagline,
            headerConfig,
            socialMedia: sanitizeSocialMediaConfig(socialMedia),
          }
        : { footerConfig };
      await updateDoc(doc(db, COLLECTIONS.site, SITE_CONFIG_ID), {
        ...patch,
        updatedAt: now,
      });
      await requestPublicRevalidate({
        getIdToken: () => user?.getIdToken(),
        scope: "site",
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isHeader ? "Header Settings" : "Footer Settings"}</SheetTitle>
          <SheetDescription>
            {isHeader
              ? "Customize your parish name, quick links, social media, colors, fonts, logo, and tagline at the top of the site."
              : "Customize footer colors, fonts, and the copyright line at the bottom of every page."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {isHeader ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="siteName">Site title</Label>
                <Input
                  id="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="My Parish"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Optional subtitle"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="showTagline"
                  type="checkbox"
                  checked={headerConfig.showTagline !== false}
                  onChange={(e) =>
                    setHeaderConfig((c) => ({ ...c, showTagline: e.target.checked }))
                  }
                />
                <Label htmlFor="showTagline">Show tagline</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="showLogo"
                  type="checkbox"
                  checked={!!headerConfig.showLogo}
                  onChange={(e) =>
                    setHeaderConfig((c) => ({ ...c, showLogo: e.target.checked }))
                  }
                />
                <Label htmlFor="showLogo">Show logo</Label>
              </div>
              {headerConfig.showLogo && (
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={headerConfig.logoUrl || ""}
                    onChange={(e) => setHeaderConfig((c) => ({ ...c, logoUrl: e.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Layout</Label>
                <Select
                  value={headerConfig.layout || "centered"}
                  onValueChange={(v) => setHeaderConfig((c) => ({ ...c, layout: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centered">Centered title</SelectItem>
                    <SelectItem value="logoLeft">Logo left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <HeaderQuickLinksEditor items={quickLinkItems} onChange={setQuickLinkItems} />

              <SocialMediaEditor value={socialMedia} onChange={setSocialMedia} />

              <HeaderStylesEditor
                styles={headerConfig.styles || DEFAULT_HEADER_STYLES}
                designColors={siteConfig?.design?.colors || {}}
                designFonts={siteConfig?.design?.fonts || {}}
                focus={focus}
                onChange={(styles) => setHeaderConfig((c) => ({ ...c, styles }))}
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="footerText">Copyright text</Label>
                <Input
                  id="footerText"
                  value={footerConfig.text || ""}
                  placeholder={`© ${new Date().getFullYear()} Parish`}
                  onChange={(e) => setFooterConfig((c) => ({ ...c, text: e.target.value }))}
                />
              </div>
              <FooterStylesEditor
                styles={footerConfig.styles || DEFAULT_FOOTER_STYLES}
                designColors={siteConfig?.design?.colors || {}}
                designFonts={siteConfig?.design?.fonts || {}}
                onChange={(styles) => setFooterConfig((c) => ({ ...c, styles }))}
              />
              <p className="text-xs text-muted-foreground">
                Footer column content is managed in site configuration. Use the fields above to style
                how columns and links appear.
              </p>
            </>
          )}
        </div>

        <SheetFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
