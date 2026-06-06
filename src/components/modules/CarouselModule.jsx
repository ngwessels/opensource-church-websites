"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export function CarouselModule({ module }) {
  const slides = module?.config?.slides || [];
  const title = module?.config?.title;
  const [index, setIndex] = useState(0);
  const safeIndex = slides.length ? index % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (!slides.length) return null;

  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <section>
      {title && (
        <h2 className="mb-4 border-b-2 border-[var(--site-primary)] pb-2 text-xl font-semibold text-zinc-900">
          {title}
        </h2>
      )}
      <div className="relative h-[320px] overflow-hidden rounded-lg bg-zinc-900 shadow-sm">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === safeIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={slide.src}
              alt={slide.alt || ""}
              fill
              className="object-cover"
              unoptimized
            />
            {slide.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-4">
                <p className="text-sm text-white">{slide.caption}</p>
              </div>
            )}
          </div>
        ))}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === safeIndex ? "bg-white" : "bg-white/50"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
