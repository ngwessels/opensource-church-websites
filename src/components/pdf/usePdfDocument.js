"use client";

import { useEffect, useState } from "react";

import { loadPdfJs } from "@/lib/pdf/loadPdfJs";

export function usePdfDocument(fetchUrl, errorMessage = "Could not load this document.") {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fetchUrl) return undefined;

    let active = true;

    async function loadDocument() {
      setLoading(true);
      setError(null);
      setPdf(null);
      setNumPages(0);

      try {
        const [pdfjsLib, response] = await Promise.all([loadPdfJs(), fetch(fetchUrl)]);

        if (!active) return;

        if (!response.ok) {
          throw new Error(`PDF request failed (${response.status})`);
        }

        const data = await response.arrayBuffer();
        if (!active) return;

        const document = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
        if (!active) return;

        setPdf(document);
        setNumPages(document.numPages);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        console.error("PDF load failed:", err);
        setError(errorMessage);
        setLoading(false);
      }
    }

    loadDocument();

    return () => {
      active = false;
    };
  }, [fetchUrl, errorMessage]);

  return { pdf, numPages, loading, error };
}
