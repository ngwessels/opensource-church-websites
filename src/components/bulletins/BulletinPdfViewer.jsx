"use client";

import { PdfViewer } from "@/components/pdf/PdfViewer";

export function BulletinPdfViewer({ date, title }) {
  const fetchUrl = `/api/bulletins/pdf?date=${encodeURIComponent(date)}`;

  return (
    <PdfViewer
      fetchUrl={fetchUrl}
      title={title}
      loadingMessage="Loading bulletin…"
      errorMessage="Could not load this bulletin."
    />
  );
}
