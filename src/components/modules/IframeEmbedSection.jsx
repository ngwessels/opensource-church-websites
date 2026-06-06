import { parseEmbedHeight } from "@/lib/embed/urls";

/**
 * Shared iframe wrapper for embed modules.
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} props.src
 * @param {number|string} [props.height]
 * @param {string} [props.className]
 */
export function IframeEmbedSection({ title, src, height, className = "" }) {
  if (!src) return null;
  const h = parseEmbedHeight(height, 400);

  return (
    <section className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">{title}</h2>
      )}
      <div className="overflow-hidden rounded-lg bg-zinc-100" style={{ height: h }}>
        <iframe
          src={src}
          title={title || "Embedded content"}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </section>
  );
}
