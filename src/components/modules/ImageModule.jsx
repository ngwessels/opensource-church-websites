"use client";

import Image from "next/image";
import { useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

const IMAGE_SIZE_CLASSES = {
  small: "max-w-[280px] max-h-80",
  medium: "max-w-md max-h-96",
  large: "max-w-xl max-h-[32rem]",
  full: "max-w-full",
};

const LIGHTBOX_DIALOG_CLASS =
  "w-auto max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[min(calc(100vw-2rem),1400px)]";

function ImageLightbox({ open, src, alt, onClose }) {
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className={LIGHTBOX_DIALOG_CLASS}>
        {src && (
          <Image
            src={src}
            alt={alt}
            width={1600}
            height={1200}
            className="max-h-[calc(100vh-4rem)] w-auto max-w-full rounded-lg object-contain"
            unoptimized
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ImageModule({ module }) {
  const { title, src, alt, caption, images, size = "small" } = module.config || {};
  const sizeClass = IMAGE_SIZE_CLASSES[size] || IMAGE_SIZE_CLASSES.small;
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
        <ImageLightbox open={!!lightbox} src={lightbox} alt="" onClose={() => setLightbox(null)} />
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
        className={`mx-auto block overflow-hidden rounded-lg bg-zinc-50 shadow-sm transition-opacity hover:opacity-95 ${sizeClass}`}
      >
        <Image
          src={src}
          alt={alt || title || ""}
          width={400}
          height={500}
          className="mx-auto h-auto w-full object-contain"
          unoptimized
        />
      </button>
      {caption && <p className="mt-2 text-sm text-zinc-500">{caption}</p>}
      <ImageLightbox
        open={!!lightbox}
        src={lightbox}
        alt={alt || ""}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
}
