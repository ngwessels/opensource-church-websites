"use client";

import { forwardRef } from "react";

import { buildPublicPreviewSrc } from "@/lib/builder/preview-url";

export const PreviewFrame = forwardRef(function PreviewFrame(
  { src = "/", device = "desktop", onLoad },
  ref,
) {
  const widths = { desktop: "100%", tablet: "768px", mobile: "375px" };
  const width = widths[device] || "100%";

  return (
    <div className="flex h-full justify-center">
      <iframe
        ref={ref}
        title="Site preview"
        src={buildPublicPreviewSrc(src)}
        onLoad={onLoad}
        className="h-full rounded border border-border bg-card shadow"
        style={{ width, maxWidth: "100%" }}
      />
    </div>
  );
});
