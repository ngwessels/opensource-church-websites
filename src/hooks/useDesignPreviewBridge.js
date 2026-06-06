"use client";

import { useEffect, useRef, useState } from "react";

export const DESIGN_PREVIEW_MESSAGE = "DESIGN_PREVIEW";

/**
 * Parent side: post draft design to preview iframe.
 * @param {React.RefObject<HTMLIFrameElement|null>} iframeRef
 * @param {object} design
 * @param {string} [origin]
 */
export function sendDesignPreview(iframeRef, preview, origin) {
  if (!iframeRef.current?.contentWindow || !preview?.design) return;
  const targetOrigin = origin || window.location.origin;
  iframeRef.current.contentWindow.postMessage(
    { type: DESIGN_PREVIEW_MESSAGE, ...preview },
    targetOrigin,
  );
}

export function useDesignPreviewSender(iframeRef, preview, origin) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !preview?.design) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      sendDesignPreview(iframeRef, preview, origin);
    }, 50);

    return () => clearTimeout(timerRef.current);
  }, [iframeRef, preview, origin]);
}

/**
 * Child side (preview iframe): listen for draft design overrides.
 * @param {boolean} enabled
 * @returns {object|null} previewDesign
 */
export function useDesignPreviewListener(enabled) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      return;
    }

    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== DESIGN_PREVIEW_MESSAGE) return;
      setPreview({
        design: event.data.design,
        headerStyles: event.data.headerStyles,
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [enabled]);

  return preview;
}
