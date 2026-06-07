"use client";

import { useMemo, useState } from "react";

import { ThemeCard } from "@/components/design/ThemeCard";
import { ThemeFilterSidebar } from "@/components/design/ThemeFilterSidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { emptyFilters, filterThemes } from "@/lib/design/theme-filters";
import { THEMES } from "@/lib/design/themes";

export function ThemeBrowserDialog({ open, onOpenChange, selectedId, onApply }) {
  const [pendingId, setPendingId] = useState(selectedId);
  const [filters, setFilters] = useState(emptyFilters());

  const filteredThemes = useMemo(
    () => filterThemes(THEMES, filters),
    [filters],
  );

  const pendingTheme = THEMES.find((t) => t.id === pendingId) || THEMES[0];

  const handleOpenChange = (next) => {
    if (next) {
      setPendingId(selectedId);
      setFilters(emptyFilters());
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[90vh] max-h-[90vh] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
        showCloseButton
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Browse Themes</DialogTitle>
          <DialogDescription>
            Choose a design theme for your parish website. Each theme has a distinct layout, not just colors.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <ThemeFilterSidebar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredThemes.length}
            totalCount={THEMES.length}
          />
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-4 p-6 xl:grid-cols-3">
              {filteredThemes.length === 0 ? (
                <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No themes match your filters. Try clearing some filters.
                </p>
              ) : (
                filteredThemes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    selected={pendingId === theme.id}
                    onClick={() => setPendingId(theme.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <div className="flex w-full items-center justify-between gap-4">
            <p className="truncate text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{pendingTheme.name}</span>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onApply(pendingTheme);
                  onOpenChange(false);
                }}
              >
                Apply theme
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
