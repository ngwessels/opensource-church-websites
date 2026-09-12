"use client";

import { Suspense } from "react";

import { BulletinsPageView } from "@/components/bulletins/BulletinsPageView";
import { useBulletins } from "@/hooks/useBulletins";
import { adminSectionHref } from "@/lib/builder/navigation";

const ADMIN_BULLETINS_PATH = adminSectionHref("bulletins");

/** Bulletin archive management, mirroring the bulletins page editor experience. */
export function BulletinsPanel() {
  const { bulletins, loading, error, refresh } = useBulletins();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Suspense
        fallback={
          <p className="py-16 text-center text-sm text-muted-foreground">Loading bulletins…</p>
        }
      >
        <BulletinsPageView
          page={{ title: "Bulletins" }}
          bulletins={bulletins}
          editing
          pageSlug={ADMIN_BULLETINS_PATH}
          onBulletinsRefresh={() => refresh({ silent: true })}
        />
      </Suspense>
    </div>
  );
}
