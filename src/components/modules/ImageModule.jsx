"use client";

import Image from "next/image";
import { useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ImageModule({ module }) {
  const { title, src, alt, caption, images } = module.config || {};
  const isGallery = module.type === "gallery" && images?.length;
  const [lightbox, setLightbox] = useState(null);

  if (isGallery) {
    return (
      <section>
        {title && (
          <h2 className="mb-4 border-b-2 border-[var(--site-primary)] pb-2 text-xl font-semibold text-zinc-900">
            {title}
          </h2>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(img.src)}
              className="overflow-hidden rounded-lg shadow-sm"
            >
              <Image
                src={img.src}
                alt={img.alt || ""}
                width={400}
                height={300}
                className="h-48 w-full object-cover transition-transform hover:scale-105"
                unoptimized
              />
            </button>
          ))}
        </div>
        <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
            {lightbox && (
              <Image src={lightbox} alt="" width={1200} height={800} className="h-auto w-full rounded-lg" unoptimized />
            )}
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  if (!src) return null;

  return (
    <section>
      {title && (
        <h2 className="mb-4 border-b-2 border-[var(--site-primary)] pb-2 text-xl font-semibold text-zinc-900">
          {title}
        </h2>
      )}
      <button
        type="button"
        onClick={() => setLightbox(src)}
        className="block w-full overflow-hidden rounded-lg shadow-sm"
      >
        <Image
          src={src}
          alt={alt || title || ""}
          width={800}
          height={500}
          className="h-auto w-full object-cover transition-transform hover:scale-[1.02]"
          unoptimized
        />
      </button>
      {caption && <p className="mt-2 text-sm text-zinc-500">{caption}</p>}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
          {lightbox && (
            <Image src={lightbox} alt={alt || ""} width={1200} height={800} className="h-auto w-full rounded-lg" unoptimized />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
