"use client";

import { useEffect, useRef, useState } from "react";

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;

let pdfJsLoader;

function loadPdfJs() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF.js is only available in the browser."));
  }

  if (window.pdfjsLib) {
    return Promise.resolve(window.pdfjsLib);
  }

  if (!pdfJsLoader) {
    pdfJsLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS_SCRIPT;
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error("PDF.js failed to load."));
          return;
        }
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("PDF.js failed to load."));
      document.head.appendChild(script);
    });
  }

  return pdfJsLoader;
}

export function BulletinPdfViewer({ date, title }) {
  const wrapperRef = useRef(null);
  const pagesRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const pages = pagesRef.current;
    const wrapper = wrapperRef.current;
    if (!pages || !wrapper) return undefined;

    let active = true;
    const pdfUrl = `/api/bulletins/pdf?date=${encodeURIComponent(date)}`;

    async function renderPdf() {
      setLoading(true);
      setError(null);
      pages.replaceChildren();

      try {
        const [pdfjsLib, response] = await Promise.all([
          loadPdfJs(),
          fetch(pdfUrl),
        ]);

        if (!active) return;

        if (!response.ok) {
          throw new Error(`PDF request failed (${response.status})`);
        }

        const data = await response.arrayBuffer();
        if (!active) return;

        const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
        if (!active) return;

        const containerWidth = wrapper.clientWidth || 640;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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

          await page.render({ canvasContext: context, viewport }).promise;

          if (!active) return;
          pages.appendChild(canvas);

          if (pageNumber === 1) {
            setLoading(false);
          }
        }

        if (active) setLoading(false);
      } catch (err) {
        if (!active) return;
        console.error("Bulletin PDF render failed:", err);
        setError("Could not load this bulletin.");
        setLoading(false);
      }
    }

    renderPdf();

    return () => {
      active = false;
    };
  }, [date, title]);

  return (
    <div ref={wrapperRef} className="min-h-[12rem] bg-zinc-100">
      {loading && (
        <p className="py-16 text-center text-sm text-zinc-500">Loading bulletin…</p>
      )}
      {error && (
        <p className="py-16 text-center text-sm text-red-600">{error}</p>
      )}
      <div ref={pagesRef} className={error ? "hidden" : undefined} />
    </div>
  );
}
