"use client";

import {
  Copy,
  FilePlus,
  Settings,
  Trash2,
  Eye,
  Plus,
  PanelBottomClose,
  Loader2,
  RotateCcw,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ADMIN_PAGE_NAV_HEIGHT } from "@/lib/design/admin-tokens";
import { AdminIconButton } from "./AdminIconButton";
import { ViewportTabs } from "./ViewportTabs";

function ToolbarDivider({ className }) {
  return (
    <div className={cn("mx-1 h-7 w-px shrink-0 bg-border", className)} aria-hidden />
  );
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
  isPublishing = false,
  canRevert = false,
  stackLayoutActive = false,
}) {
  return (
    <div
      className="admin-page-nav flex min-w-0 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 lg:gap-4 lg:px-5"
      style={{ height: ADMIN_PAGE_NAV_HEIGHT }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        {!hideContentTray && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={onAddContent}
              className={cn(
                "h-9 shrink-0 gap-1.5 px-2.5 font-medium shadow-sm sm:px-3.5",
                trayOpen
                  ? "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              aria-label={trayOpen ? "Close content library" : "Add content"}
            >
              {trayOpen ? (
                <PanelBottomClose className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="hidden lg:inline">{trayOpen ? "Close Library" : "Add Content"}</span>
            </Button>

            <ToolbarDivider className="hidden sm:block" />
          </>
        )}

        <div
          className="hidden items-center rounded-lg border border-border/90 bg-muted/80 p-0.5 md:flex"
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0 text-muted-foreground md:hidden"
              aria-label="Page actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onAddPage}>
              <FilePlus className="h-4 w-4" />
              Add Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
              Duplicate Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4" />
              Delete Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPageSettings}>
              <Settings className="h-4 w-4" />
              Page Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onPreviewDeviceChange && (
          <>
            <ToolbarDivider className="hidden sm:block" />
            <div className="flex min-w-0 flex-col gap-1">
              <ViewportTabs
                value={previewDevice}
                onChange={onPreviewDeviceChange}
                size="compact"
                className="min-w-0 sm:min-w-[9rem] xl:min-w-[220px]"
              />
              {stackLayoutActive && (
                <p className="hidden max-w-[220px] text-center text-[10px] leading-tight text-muted-foreground xl:block">
                  Reordering applies to this screen size only
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRevert}
          disabled={!canRevert}
          className="h-9 gap-1.5 border-border bg-card px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
          aria-label="Revert changes"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Revert</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreview}
          className="h-9 gap-1.5 border-border bg-card px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
          aria-label="Preview page"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Preview</span>
        </Button>

        <ToolbarDivider className="hidden sm:block" />

        <Button
          size="sm"
          className="h-9 gap-1.5 px-3 font-medium shadow-sm sm:px-4"
          onClick={onPublish}
          disabled={!canPublish || isPublishing}
          aria-busy={isPublishing}
        >
          {isPublishing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {isPublishing ? (
            <span className="hidden sm:inline">Publishing…</span>
          ) : (
            "Publish"
          )}
          {isPublishing && <span className="sm:hidden">…</span>}
        </Button>
      </div>
    </div>
  );
}
