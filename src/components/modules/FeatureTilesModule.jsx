import Image from "next/image";
import Link from "next/link";

function FeatureTile({ item }) {
  const { label, href, imageSrc } = item;
  const inner = (
    <>
      <div className="site-feature-tile-image relative bg-zinc-100">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={label || ""}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center text-sm text-zinc-400">
            No image
          </div>
        )}
      </div>
      {label && <p className="site-feature-tile-label">{label}</p>}
    </>
  );

  if (href?.startsWith("http")) {
    return (
      <a
        href={href}
        className="site-feature-tile block transition-opacity hover:opacity-95"
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href || "#"} className="site-feature-tile block transition-opacity hover:opacity-95">
      {inner}
    </Link>
  );
}

export function FeatureTilesModule({ module, editing = false }) {
  const items = module?.config?.items || [];
  if (!items.length) {
    if (!editing) return null;
    return (
      <div className="site-feature-tiles border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        Add feature tiles in the module editor
      </div>
    );
  }

  return (
    <div className="site-feature-tiles">
      {items.map((item, i) => (
        <FeatureTile key={i} item={item} />
      ))}
    </div>
  );
}
