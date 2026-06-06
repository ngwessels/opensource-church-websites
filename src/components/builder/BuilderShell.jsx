"use client";

import { AdminToolbar } from "./AdminToolbar";
import { ADMIN_PAGE_NAV_HEIGHT } from "@/lib/design/admin-tokens";

export function BuilderShell({ children, bottomBar, moduleTrayOpen = false }) {
  return (
    <div className="flex h-screen flex-col bg-muted">
      <AdminToolbar />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="min-h-0 flex-1 overflow-auto bg-card"
          style={{
            paddingBottom: bottomBar ? ADMIN_PAGE_NAV_HEIGHT : 0,
          }}
        >
          {children}
        </div>
        {bottomBar}
      </div>
    </div>
  );
}
