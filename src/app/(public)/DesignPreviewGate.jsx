"use client";

import { useEffect, useState } from "react";

import { DesignPreviewClient } from "./DesignPreviewClient";

function isDesignPreviewUrl() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("designPreview") === "1";
}

/**
 * Swaps to the design preview client when ?designPreview=1 is present.
 * Uses window.location instead of useSearchParams so public pages stay statically rendered.
 */
export function DesignPreviewGate({ slug, children }) {
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setPreview(isDesignPreviewUrl());
  }, []);

  if (preview) {
    return <DesignPreviewClient slug={slug} designPreviewEnabled />;
  }

  return children;
}
