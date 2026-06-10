"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { DesignPreviewClient } from "./DesignPreviewClient";

function PublicPageGateInner({ slug, children }) {
  const searchParams = useSearchParams();
  const designPreview = searchParams.get("designPreview") === "1";

  if (designPreview) {
    return <DesignPreviewClient slug={slug} />;
  }

  return children;
}

export function PublicPageGate({ slug, children }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading…</div>
      }
    >
      <PublicPageGateInner slug={slug}>{children}</PublicPageGateInner>
    </Suspense>
  );
}
