"use client";

import { Download, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { PinchZoom } from "@/components/ui/PinchZoom";
import { cn } from "@/lib/utils";

const MODAL_DIALOG_CLASS =
  "flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-0 bg-zinc-900 p-0 text-white shadow-none sm:max-w-[calc(100vw-1rem)] lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)] lg:max-w-[min(calc(100vw-2rem),1200px)] [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10";

const PAGE_SURFACE_CLASS = "w-full min-h-[12rem]";

const MIN_DESKTOP_ZOOM = 0.5;
const MAX_DESKTOP_ZOOM = 4;
const DESKTOP_ZOOM_STEP = 0.25;

function clampZoom(value) {
  return Math.min(MAX_DESKTOP_ZOOM, Math.max(MIN_DESKTOP_ZOOM, value));
}

function printPdf(url) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  document.body.appendChild(iframe);

  const cleanup = () => {
    iframe.remove();
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(cleanup, 1000);
    }
  };
}

function getContainerWidth(surface) {
  if (!surface) return 640;
  const width = surface.clientWidth - 16;
  return width > 0 ? width : 640;
}

export function PdfViewerModal({
  open,
  onOpenChange,
  pdf,
  title = "Document",
  fetchUrl,
  downloadUrl,
}) {
  const [surfaceEl, setSurfaceEl] = useState(null);
  const [pageHostEl, setPageHostEl] = useState(null);
  const [desktopZoom, setDesktopZoom] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const fileUrl = downloadUrl || fetchUrl;

  useEffect(() => {
    if (!surfaceEl || !open) return undefined;

    let lastWidth = getContainerWidth(surfaceEl);

    const observer = new ResizeObserver(() => {
      const width = getContainerWidth(surfaceEl);
      if (Math.abs(width - lastWidth) > 1) {
        lastWidth = width;
        setLayoutVersion((version) => version + 1);
      }
    });
    observer.observe(surfaceEl);
    return () => observer.disconnect();
  }, [open, surfaceEl]);

  useEffect(() => {
    if (!open || !pdf || !pageHostEl || !surfaceEl) {
      return undefined;
    }

    const total = pdf.numPages;
    let active = true;
    let renderTask;

    async function renderAllPages() {
      setRendering(true);
      setRenderError(null);
      pageHostEl.replaceChildren();

      try {
        const containerWidth = getContainerWidth(surfaceEl);

        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          if (!active) return;

          const page = await pdf.getPage(pageNumber);
          if (!active) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth / baseViewport.width) * desktopZoom;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className =
            "mx-auto mb-3 block max-w-full bg-white shadow-lg last:mb-0";
          canvas.setAttribute(
            "aria-label",
            `${title} — page ${pageNumber} of ${total}`,
          );

          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas is not available.");
          }

          renderTask = page.render({ canvasContext: context, viewport });
          await renderTask.promise;
          if (!active) return;

          pageHostEl.appendChild(canvas);

          if (pageNumber === 1) {
            setRendering(false);
          }
        }
      } catch (err) {
        if (!active) return;
        if (err?.name === "RenderingCancelledException") return;
        console.error("PDF render failed:", err);
        setRenderError("Could not display this document.");
      } finally {
        if (active) setRendering(false);
      }
    }

    renderAllPages();

    return () => {
      active = false;
      renderTask?.cancel?.();
    };
  }, [open, pdf, desktopZoom, title, layoutVersion, surfaceEl, pageHostEl]);

  const zoomOut = () => {
    setDesktopZoom((zoom) => clampZoom(zoom - DESKTOP_ZOOM_STEP));
  };

  const zoomIn = () => {
    setDesktopZoom((zoom) => clampZoom(zoom + DESKTOP_ZOOM_STEP));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={MODAL_DIALOG_CLASS} showCloseButton>
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 pr-12 sm:px-4 sm:pr-14">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {title}
          </p>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-1 md:flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={zoomOut}
                disabled={desktopZoom <= MIN_DESKTOP_ZOOM}
                aria-label="Zoom out"
              >
                <ZoomOut />
              </Button>
              <span className="w-12 text-center text-xs text-zinc-300">
                {Math.round(desktopZoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={zoomIn}
                disabled={desktopZoom >= MAX_DESKTOP_ZOOM}
                aria-label="Zoom in"
              >
                <ZoomIn />
              </Button>
            </div>

            {fileUrl && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    aria-label="Download PDF"
                  >
                    <Download />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => printPdf(fileUrl)}
                  aria-label="Print PDF"
                >
                  <Printer />
                </Button>
              </>
            )}
          </div>
        </div>

        <div
          ref={setSurfaceEl}
          className={cn(
            "relative min-h-0 flex-1 overflow-auto bg-zinc-950 px-2 py-3 sm:px-4",
            rendering && "opacity-90",
          )}
        >
          {rendering && !renderError && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
              Loading document…
            </p>
          )}
          {renderError && (
            <p className="py-16 text-center text-sm text-red-400">{renderError}</p>
          )}
          <PinchZoom
            resetKey={`${open}-${desktopZoom}`}
            className={PAGE_SURFACE_CLASS}
          >
            <div ref={setPageHostEl} className="mx-auto w-full" />
          </PinchZoom>
        </div>
      </DialogContent>
    </Dialog>
  );
}
