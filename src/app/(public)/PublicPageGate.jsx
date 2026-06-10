"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PublicPageClient } from "./PublicPageClient";

function PublicPageGateInner({ slug, children }) {
  const searchParams = useSearchParams();
  const designPreview = searchParams.get("designPreview") === "1";

  if (designPreview) {
    return <PublicPageClient slug={slug} />;
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
