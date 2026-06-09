"use client";

import { PdfViewer } from "@/components/pdf/PdfViewer";

export function BulletinPdfViewer({ date, title, downloadUrl }) {
  const fetchUrl = `/api/bulletins/pdf?date=${encodeURIComponent(date)}`;

  return (
    <PdfViewer
      fetchUrl={fetchUrl}
      title={title}
      downloadUrl={downloadUrl}
      loadingMessage="Loading bulletin…"
      errorMessage="Could not load this bulletin."
    />
  );
}
