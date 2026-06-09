"use client";

import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { AdminPageNav } from "./AdminPageNav";
import { ModuleTray } from "./ModuleTray";

export function AdminFooter({
  trayOpen,
  hideContentTray = false,
  previewDevice = "desktop",
  onPreviewDeviceChange,
  onCloseTray,
  onAddModule,
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
  dropError,
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0"
      style={{ zIndex: ADMIN_Z.pageNav }}
    >
      {dropError && (
        <div
          className="pointer-events-auto error-banner-shake mx-auto mb-0 max-w-lg rounded-t-lg bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 shadow-md"
          style={{ zIndex: ADMIN_Z.errorBanner }}
        >
          {dropError}
        </div>
      )}
      <div className="pointer-events-auto">
        {!hideContentTray && (
          <ModuleTray open={trayOpen} onClose={onCloseTray} onAddModule={onAddModule} />
        )}
        <AdminPageNav
          trayOpen={trayOpen}
          hideContentTray={hideContentTray}
          previewDevice={previewDevice}
          onPreviewDeviceChange={onPreviewDeviceChange}
          onAddContent={onAddContent}
          onAddPage={onAddPage}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onPageSettings={onPageSettings}
          onRevert={onRevert}
          onPreview={onPreview}
          onPublish={onPublish}
          canPublish={canPublish}
          isPublishing={isPublishing}
          canRevert={canRevert}
        />
      </div>
    </div>
  );
}
