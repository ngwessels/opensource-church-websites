import { IframeEmbedSection } from "./IframeEmbedSection";
import { normalizeHttpsUrl, parseEmbedHeight } from "@/lib/embed/urls";

export function EmbedModule({ module }) {
  const { title, embedUrl, html, height } = module.config || {};
  const normalizedUrl = normalizeHttpsUrl(embedUrl);
  const h = parseEmbedHeight(height, 400);

  if (html?.trim()) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        {title && (
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">{title}</h2>
        )}
        <div
          className="embed-html overflow-hidden rounded-lg"
          style={{ minHeight: h }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </section>
    );
  }

  if (!normalizedUrl) return null;

  return <IframeEmbedSection title={title} src={normalizedUrl} height={height} />;
}
