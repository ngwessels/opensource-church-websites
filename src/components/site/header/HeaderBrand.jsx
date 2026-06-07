"use client";

import Image from "next/image";

export function HeaderBrand({
  name,
  tagline,
  showLogo,
  showTagline,
  logoUrl,
  headerStyles,
  layout = "centered",
  compact = false,
}) {
  const isLeft = layout === "logoLeft" || layout === "inline";

  return (
    <div
      className={`flex items-center gap-6 ${
        isLeft ? "flex-row" : "flex-col justify-center"
      } ${compact ? "min-w-0 flex-1" : ""}`}
    >
      {showLogo && (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-white/10">
          <Image src={logoUrl} alt="" fill className="object-cover" unoptimized />
        </div>
      )}
      <div className={isLeft ? "min-w-0" : ""}>
        <h1
          className={
            headerStyles.titleFontSize
              ? "break-words"
              : compact
                ? "break-words text-xl tracking-wide md:text-2xl"
                : "break-words text-3xl tracking-wide md:text-4xl"
          }
          style={{
            color: headerStyles.titleColor,
            fontFamily: headerStyles.titleFont,
            fontWeight: headerStyles.titleFontWeight,
            fontSize: headerStyles.titleFontSize || undefined,
          }}
        >
          {name}
        </h1>
        {showTagline && tagline && (
          <p
            className={`site-header-tagline ${headerStyles.titleFontSize ? "mt-2" : "mt-2 text-sm md:text-base"}`}
            style={{
              color: headerStyles.taglineColor,
              fontFamily: headerStyles.taglineFont,
            }}
          >
            {tagline}
          </p>
        )}
      </div>
    </div>
  );
}
