"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PdfViewerModal } from "@/components/pdf/PdfViewerModal";
import { usePdfDocument } from "@/components/pdf/usePdfDocument";
import { cn } from "@/lib/utils";

export function PdfViewer({
  fetchUrl,
  title = "Document",
  downloadUrl,
  loadingMessage = "Loading document…",
  errorMessage = "Could not load this document.",
}) {
  const wrapperRef = useRef(null);
  const pagesRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const { pdf, numPages, loading, error } = usePdfDocument(fetchUrl, errorMessage);

  useEffect(() => {
    const pages = pagesRef.current;
    const wrapper = wrapperRef.current;
    if (!pages || !wrapper || !pdf || modalOpen) return undefined;

    let active = true;

    async function renderInlinePages() {
      pages.replaceChildren();

      try {
        const containerWidth = wrapper.clientWidth || 640;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (!active) return;

          const page = await pdf.getPage(pageNumber);
          if (!active) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto mb-2 block w-full last:mb-0";
          canvas.setAttribute(
            "aria-label",
            `${title} — page ${pageNumber} of ${pdf.numPages}`,
          );

          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas is not available.");
          }

          const renderTask = page.render({ canvasContext: context, viewport });
          await renderTask.promise;

          if (!active) return;
          pages.appendChild(canvas);
        }
      } catch (err) {
        if (!active) return;
        if (err?.name === "RenderingCancelledException") return;
        console.error("PDF render failed:", err);
      }
    }

    renderInlinePages();

    return () => {
      active = false;
    };
  }, [pdf, title, modalOpen]);

  const openModal = () => {
    if (!error && !loading && pdf) {
      setModalKey((key) => key + 1);
      setModalOpen(true);
    }
  };

  const handlePreviewKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal();
    }
  };

  return (
    <div>
      <div
        ref={wrapperRef}
        role="button"
        tabIndex={error || loading ? -1 : 0}
        aria-label={`Open ${title} in full screen`}
        onClick={openModal}
        onKeyDown={handlePreviewKeyDown}
        className={cn(
          "min-h-[12rem] bg-zinc-100 outline-none",
          !error && !loading && pdf && "cursor-zoom-in hover:ring-2 hover:ring-[var(--site-primary)]/30 focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]",
        )}
      >
        {loading && (
          <p className="py-16 text-center text-sm text-zinc-500">{loadingMessage}</p>
        )}
        {error && <p className="py-16 text-center text-sm text-red-600">{error}</p>}
        <div ref={pagesRef} className={error ? "hidden" : undefined} />
      </div>

      <PdfViewerModal
        key={modalKey}
        open={modalOpen}
        onOpenChange={setModalOpen}
        pdf={pdf}
        numPages={numPages}
        title={title}
        fetchUrl={fetchUrl}
        downloadUrl={downloadUrl}
      />

      {downloadUrl && !error && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--site-primary)] hover:underline"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      )}
    </div>
  );
}
