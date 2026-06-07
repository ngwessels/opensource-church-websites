"use client";

import {
  Copy,
  FilePlus,
  Settings,
  Trash2,
  Eye,
  Plus,
  PanelBottomClose,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMIN_PAGE_NAV_HEIGHT } from "@/lib/design/admin-tokens";
import { AdminIconButton } from "./AdminIconButton";
import { ViewportTabs } from "./ViewportTabs";

function ToolbarDivider() {
  return <div className="mx-1 h-7 w-px shrink-0 bg-border" aria-hidden />;
}

export function AdminPageNav({
  trayOpen,
  hideContentTray = false,
  previewDevice = "desktop",
  onPreviewDeviceChange,
  onAddContent,
  onAddPage,
  onDuplicate,
  onDelete,
  onPageSettings,
  onRevert,
  onPreview,
  onPublish,
  canPublish = false,
  canRevert = false,
}) {
  return (
    <div
      className="admin-page-nav flex items-center justify-between gap-4 px-5"
      style={{ height: ADMIN_PAGE_NAV_HEIGHT }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {!hideContentTray && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={onAddContent}
              className={cn(
                "h-9 gap-1.5 px-3.5 font-medium shadow-sm",
                trayOpen
                  ? "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {trayOpen ? (
                <PanelBottomClose className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {trayOpen ? "Close Library" : "Add Content"}
            </Button>

            <ToolbarDivider />
          </>
        )}

        <div
          className="flex items-center rounded-lg border border-border/90 bg-muted/80 p-0.5"
          role="toolbar"
          aria-label="Page actions"
        >
          <AdminIconButton icon={FilePlus} label="Add Page" onClick={onAddPage} />
          <AdminIconButton icon={Copy} label="Duplicate Page" onClick={onDuplicate} />
          <AdminIconButton
            icon={Trash2}
            label="Delete Page"
            onClick={onDelete}
            className="hover:bg-red-50 hover:text-red-600"
          />
          <AdminIconButton icon={Settings} label="Page Settings" onClick={onPageSettings} />
        </div>

        {onPreviewDeviceChange && (
          <>
            <ToolbarDivider />
            <ViewportTabs
              value={previewDevice}
              onChange={onPreviewDeviceChange}
              size="compact"
              className="hidden min-w-[220px] sm:flex"
            />
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRevert}
          disabled={!canRevert}
          className="h-9 gap-1.5 border-border bg-card px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Revert
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreview}
          className="h-9 gap-1.5 border-border bg-card px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>

        <ToolbarDivider />

        <Button
          size="sm"
          className="h-9 px-4 font-medium shadow-sm"
          onClick={onPublish}
          disabled={!canPublish}
        >
          Publish
        </Button>
      </div>
    </div>
  );
}
