"use client";

import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FontField } from "@/components/design/FontField";
import { getThemeById } from "@/lib/design/themes";

function ColorField({ label, value, onChange }) {
  const hex = value?.startsWith("#") ? value : "#000000";

  return (
    <div className="space-y-1.5">
      <Label className="capitalize">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border"
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function ColorFontEditor({ design, headerStyles, onChange, onHeaderStylesChange }) {
  const colors = design?.colors || {};
  const fonts = design?.fonts || {};
  const theme = getThemeById(design?.themeId);

  const resetToTheme = () => {
    onChange({
      colors: { ...theme.colors },
      fonts: { ...theme.fonts },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Overrides for <span className="font-medium text-foreground">{theme.name}</span>
        </p>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={resetToTheme}>
          <RotateCcwIcon className="size-3" />
          Reset
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Colors</h3>
        <div className="space-y-3">
          {["primary", "secondary", "accent"].map((key) => (
            <ColorField
              key={key}
              label={key}
              value={colors[key]}
              onChange={(v) => onChange({ colors: { ...colors, [key]: v } })}
            />
          ))}
        </div>
      </div>

      {onHeaderStylesChange && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">Header text</h3>
          <p className="text-xs text-muted-foreground">
            Set title, tagline, and navigation link colors independently.
          </p>
          <div className="space-y-3">
            <ColorField
              label="title"
              value={headerStyles?.titleColor}
              onChange={(v) => onHeaderStylesChange({ ...headerStyles, titleColor: v })}
            />
            <ColorField
              label="tagline"
              value={headerStyles?.taglineColor}
              onChange={(v) => onHeaderStylesChange({ ...headerStyles, taglineColor: v })}
            />
            <ColorField
              label="navigation"
              value={headerStyles?.navTextColor}
              onChange={(v) => onHeaderStylesChange({ ...headerStyles, navTextColor: v })}
            />
          </div>
        </div>
      )}

      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-foreground">Fonts</h3>
        <div className="space-y-3">
          <FontField
            label="Heading"
            value={fonts.heading}
            onChange={(v) => onChange({ fonts: { ...fonts, heading: v } })}
          />
          <FontField
            label="Body"
            value={fonts.body}
            onChange={(v) => onChange({ fonts: { ...fonts, body: v } })}
          />
        </div>
      </div>
    </div>
  );
}
