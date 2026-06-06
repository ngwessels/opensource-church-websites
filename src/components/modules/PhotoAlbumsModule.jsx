import Image from "next/image";
import Link from "next/link";

function AlbumCard({ album }) {
  const { label, href, imageSrc, photoCount } = album;
  const countLabel =
    typeof photoCount === "number" && photoCount > 0
      ? `${photoCount} Photo${photoCount === 1 ? "" : "s"}`
      : null;

  const inner = (
    <>
      <div className="overflow-hidden rounded-lg bg-zinc-100 shadow-sm">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={label || ""}
            width={400}
            height={300}
            className="h-48 w-full object-cover transition-transform group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">No image</div>
        )}
      </div>
      <div className="mt-2 text-center">
        {label && <p className="font-medium text-zinc-900">{label}</p>}
        {countLabel && <p className="text-sm text-zinc-500">{countLabel}</p>}
      </div>
    </>
  );

  const className = "group block text-left transition-opacity hover:opacity-90";

  if (href?.startsWith("http")) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return (
    <Link href={href || "#"} className={className}>
      {inner}
    </Link>
  );
}

export function PhotoAlbumsModule({ module }) {
  const { title, albums = [] } = module.config || {};
  if (!albums.length) return null;

  return (
    <section>
      {title && (
        <h2 className="mb-4 border-b-2 border-[var(--site-primary)] pb-2 text-xl font-semibold text-zinc-900">
          {title}
        </h2>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {albums.map((album, i) => (
          <AlbumCard key={i} album={album} />
        ))}
      </div>
    </section>
  );
}
