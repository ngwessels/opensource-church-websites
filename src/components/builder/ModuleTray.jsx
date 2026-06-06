"use client";

import { GripHorizontal, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ADMIN_Z, MODULE_TRAY_HEIGHT } from "@/lib/design/admin-tokens";
import { MODULE_CATEGORIES } from "@/types/firestore";

import { ModuleTile } from "./ModuleTile";

export function ModuleTray({ open, onClose, onAddModule }) {
  const categories = Object.keys(MODULE_CATEGORIES);
  const [category, setCategory] = useState(categories[0] || "Core");

  return (
    <div
      className="admin-module-tray overflow-hidden transition-[height] duration-300 ease-out"
      style={{
        height: open ? MODULE_TRAY_HEIGHT : 0,
        zIndex: ADMIN_Z.moduleTray,
      }}
      data-state={open ? "open" : "closed"}
    >
      <div className="flex h-full flex-col" style={{ height: MODULE_TRAY_HEIGHT }}>
        <div className="flex items-start justify-between gap-4 border-b border-border/80 bg-card px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Content Library</h2>
            </div>
            <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
              Drag a module onto your page, or click to add it to the main column.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close content library"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs
          value={category}
          onValueChange={setCategory}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b border-border/60 bg-card px-5">
            <TabsList
              variant="line"
              className="h-10 w-full justify-start gap-4 rounded-none bg-transparent p-0"
            >
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className={cn(
                    "h-10 flex-none rounded-none px-0 pb-2.5 text-xs font-medium text-muted-foreground after:bottom-0 data-[state=active]:text-foreground data-[state=active]:after:bg-[var(--admin-accent)]",
                  )}
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {categories.map((cat) => {
            const modules = MODULE_CATEGORIES[cat] || [];
            return (
              <TabsContent
                key={cat}
                value={cat}
                className="mt-0 min-h-0 flex-1 bg-muted/80 px-5 py-4"
              >
                <ScrollArea className="h-[200px]">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3 pr-3">
                    {modules.map((type) => (
                      <ModuleTile key={type} type={type} onAddModule={onAddModule} />
                    ))}
                    {modules.length === 0 && (
                      <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                        No modules in this category yet.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
