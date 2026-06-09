"use client";

import dynamic from "next/dynamic";
import { FileText } from "lucide-react";

import { isPdfDocument } from "@/lib/documents/schema";

const PdfViewer = dynamic(
  () => import("@/components/pdf/PdfViewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-sm text-zinc-500">Loading document…</p>
    ),
  },
);

function DocumentLinkItem({ item }) {
  return (
    <li>
      <a
        href={item.url}
        className="flex items-center gap-2 text-sm text-zinc-700 hover:text-[var(--site-primary)]"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
        {item.label}
      </a>
    </li>
  );
}

function DocumentInlineItem({ item }) {
  const fetchUrl = `/api/media/pdf?mediaId=${encodeURIComponent(item.mediaId)}`;

  return (
    <div className="space-y-2">
      {item.label && (
        <h3 className="text-base font-semibold text-zinc-900">{item.label}</h3>
      )}
      <div className="overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
        <PdfViewer
          fetchUrl={fetchUrl}
          title={item.label || "Document"}
          downloadUrl={item.url}
        />
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-[var(--site-primary)] hover:underline"
      >
        Download PDF
      </a>
    </div>
  );
}

export function DocumentsModule({ module }) {
  const { title, items = [] } = module.config || {};
  const linkItems = items.filter((item) => item.displayMode !== "inline");
  const inlineItems = items.filter(
    (item) => item.displayMode === "inline" && item.mediaId && isPdfDocument(item),
  );

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {title && (
        <h2 className="mb-3 text-base font-semibold text-zinc-900">{title}</h2>
      )}

      {inlineItems.length > 0 && (
        <div className="space-y-6">
          {inlineItems.map((item, i) => (
            <DocumentInlineItem key={item.mediaId || i} item={item} />
          ))}
        </div>
      )}

      {linkItems.length > 0 && (
        <ul className={inlineItems.length > 0 ? "mt-6 space-y-2" : "space-y-2"}>
          {linkItems.map((item, i) => (
            <DocumentLinkItem key={i} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
