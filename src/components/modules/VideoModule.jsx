export function VideoModule({ module }) {
  const config = module?.config || {};
  const title = config.title;
  const source = config.source || "youtube";
  const embedUrl = config.embedUrl;
  const src = config.src;

  const hasEmbed = (source === "youtube" || source === "vimeo") && embedUrl;
  const hasDirect = (source === "upload" || source === "url") && src;

  if (!hasEmbed && !hasDirect) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">{title}</h2>
      )}
      <div className="aspect-video overflow-hidden rounded-lg bg-zinc-900">
        {hasEmbed ? (
          <iframe
            src={embedUrl}
            title={title || "Video"}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <video src={src} controls className="h-full w-full" playsInline>
            <track kind="captions" />
          </video>
        )}
      </div>
    </section>
  );
}
