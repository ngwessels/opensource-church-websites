"use client";

import { useState } from "react";
import { LayoutGridIcon } from "lucide-react";

import { ThemeBrowserDialog } from "@/components/design/ThemeBrowserDialog";
import { ThemeCard } from "@/components/design/ThemeCard";
import { Button } from "@/components/ui/button";
import { getThemeById } from "@/lib/design/themes";

export function ThemeGallery({ selectedId, onSelect }) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const activeTheme = getThemeById(selectedId);

  return (
    <div className="space-y-4">
      <ThemeCard theme={activeTheme} selected compact />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setBrowserOpen(true)}
      >
        <LayoutGridIcon className="size-4" />
        Browse themes
      </Button>
      <ThemeBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        selectedId={selectedId}
        onApply={onSelect}
      />
    </div>
  );
}
