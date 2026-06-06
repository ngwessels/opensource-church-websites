"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function HeroSlideshow({ module, editing = false }) {
  const slides = module?.config?.slides || [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (!slides.length) {
    if (!editing) return null;
    return (
      <div className="flex h-[480px] items-center justify-center bg-zinc-200 text-zinc-500">
        Add slideshow images in the module editor
      </div>
    );
  }

  return (
    <div className="relative h-[480px] w-full overflow-hidden bg-zinc-900">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt || ""}
            fill
            className="object-cover"
            unoptimized
            priority={i === 0}
          />
          {slide.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 py-8">
              <p className="text-lg text-white">{slide.caption}</p>
            </div>
          )}
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
