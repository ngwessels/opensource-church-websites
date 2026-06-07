"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

function SlideCaption({ slide, captionLayout }) {
  if (captionLayout === "centered") {
    const title = slide.title || slide.caption;
    if (!title && !slide.subtitle && !slide.ctaLabel) return null;
    return (
      <div className="site-hero-caption-centered">
        {title && <h2 className="site-hero-caption-title">{title}</h2>}
        {slide.subtitle && <p className="site-hero-caption-subtitle">{slide.subtitle}</p>}
        {slide.ctaLabel && (
          slide.ctaHref?.startsWith("http") ? (
            <a href={slide.ctaHref} className="site-hero-cta" target="_blank" rel="noopener noreferrer">
              {slide.ctaLabel}
            </a>
          ) : (
            <Link href={slide.ctaHref || "#"} className="site-hero-cta">
              {slide.ctaLabel}
            </Link>
          )
        )}
      </div>
    );
  }

  if (captionLayout === "overlayBoxLeft") {
    const title = slide.title || slide.caption;
    if (!title && !slide.subtitle) return null;
    return (
      <div className="site-hero-caption-box">
        {title && <h2 className="site-hero-caption-title">{title}</h2>}
        {slide.subtitle && <p className="site-hero-caption-subtitle">{slide.subtitle}</p>}
      </div>
    );
  }

  if (!slide.caption) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 py-8">
      <p className="text-lg text-white">{slide.caption}</p>
    </div>
  );
}

export function HeroSlideshow({ module, editing = false, captionLayout = "bottomGradient" }) {
  const slides = module?.config?.slides || [];
  const [index, setIndex] = useState(0);
  const layout = captionLayout || "bottomGradient";
  const wrapperClass =
    layout === "centered"
      ? "site-hero-slideshow--centered"
      : layout === "overlayBoxLeft"
        ? "site-hero-slideshow--overlayBox"
        : "";

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
    <div className={`relative h-[480px] w-full overflow-hidden bg-zinc-900 ${wrapperClass}`}>
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
          <SlideCaption slide={slide} captionLayout={layout} />
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
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
