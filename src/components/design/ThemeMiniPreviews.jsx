"use client";

function MiniNav({ colors, variant, fonts, headerTone = "dark" }) {
  const isInline = variant === "inlineHeader";
  const isPill = variant === "pillTabs";
  const isUnderline = variant === "underlineTabs";
  const isMinimal = variant === "minimalText";
  const isLight = headerTone === "light";

  const navBg = isLight || isMinimal || isInline ? "transparent" : colors.secondary;
  const linkColor = isLight || isMinimal || isInline ? colors.text || colors.primary : "#ffffff";

  return (
    <div
      className={`flex gap-0.5 px-2 py-1 ${isInline ? "justify-end" : ""}`}
      style={{
        background: isLight ? colors.background || "#fff" : isInline ? "transparent" : navBg,
        borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : undefined,
      }}
    >
      {["Home", "About", "Contact"].map((label, i) => (
        <span
          key={label}
          className="text-[7px]"
          style={{
            fontFamily: fonts.body,
            color: linkColor,
            borderRadius: isPill ? "9999px" : undefined,
            borderBottom: isUnderline && i === 0 ? `1px solid ${colors.primary}` : isUnderline ? "1px solid transparent" : undefined,
            padding: isPill ? "1px 4px" : undefined,
            background: isPill ? `${colors.secondary}33` : undefined,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function MiniQuickLinks({ variant, colors }) {
  if (variant === "utilityBar") {
    return (
      <div
        className="flex gap-1 border-b px-2 py-0.5 text-[6px]"
        style={{ background: colors.background || "#fff", color: colors.text || "#18181b", borderColor: "rgba(0,0,0,0.08)" }}
      >
        <span>Calendar</span>
        <span className="opacity-40">|</span>
        <span>Contact</span>
      </div>
    );
  }
  if (variant === "boxedCta") {
    return (
      <div className="absolute right-1 top-0.5 flex gap-0.5">
        {["Visit", "Contact"].map((label) => (
          <span
            key={label}
            className="border px-1 text-[5px]"
            style={{ borderColor: "rgba(0,0,0,0.2)", color: colors.text || "#18181b" }}
          >
            {label}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

function MiniHeader({ theme }) {
  const { colors, fonts, structure } = theme;
  const headerVariant = structure?.headerVariant || "centeredBanner";
  const headerTone = structure?.headerTone || "dark";
  const quickLinksVariant = structure?.quickLinksVariant || "inline";
  const isLight = headerTone === "light";
  const inlineNav = headerVariant === "inlineNav";
  const hero = headerVariant === "heroBand";
  const minimal = headerVariant === "minimalBar";
  const logoLeft =
    headerVariant === "logoLeftStack" || headerVariant === "lightLogoLeft" || minimal;
  const centered = headerVariant === "centeredBanner" || headerVariant === "lightCentered" || hero;

  const py = hero ? "py-3" : minimal ? "py-1" : "py-2";
  const headerBg = isLight ? colors.background || "#fff" : colors.primary;
  const titleColor = isLight ? colors.text || "#18181b" : "#ffffff";

  return (
    <div className="relative">
      {quickLinksVariant === "utilityBar" && <MiniQuickLinks variant={quickLinksVariant} colors={colors} />}
      <div
        className={`flex items-center px-2 ${py} ${
          inlineNav ? "justify-between" : logoLeft && !centered ? "justify-start" : "justify-center"
        }`}
        style={{
          background: headerBg,
          borderBottom: isLight ? "1px solid rgba(0,0,0,0.06)" : undefined,
        }}
      >
        {quickLinksVariant === "boxedCta" && <MiniQuickLinks variant={quickLinksVariant} colors={colors} />}
        <div className={`flex items-center gap-1 ${inlineNav || logoLeft ? "" : "flex-col"}`}>
          {(logoLeft || headerVariant === "lightCentered") && (
            <span
              className={`shrink-0 rounded-sm ${headerVariant === "lightCentered" ? "h-3 w-3" : "h-2.5 w-2.5"}`}
              style={{ background: isLight ? colors.primary : colors.accent }}
            />
          )}
          <span
            className="truncate text-[9px] font-semibold leading-none"
            style={{
              fontFamily: fonts.heading,
              color: titleColor,
              textTransform: headerVariant === "lightCentered" ? "uppercase" : undefined,
              letterSpacing: headerVariant === "lightCentered" ? "0.08em" : undefined,
            }}
          >
            Parish Name
          </span>
        </div>
        {inlineNav && (
          <MiniNav colors={colors} fonts={fonts} variant="inlineHeader" headerTone={headerTone} />
        )}
      </div>
    </div>
  );
}

function MiniFeatureTiles({ colors }) {
  return (
    <div className="grid grid-cols-4 border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-r last:border-r-0" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="aspect-[3/4] bg-zinc-200" style={{ opacity: 0.5 + i * 0.1 }} />
          <div className="py-0.5 text-center text-[5px]" style={{ color: colors.text || "#18181b" }}>
            Link
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniHero({ theme }) {
  const { colors, structure } = theme;
  const variant = structure?.heroCaptionVariant || "bottomGradient";
  const featuresVariant = structure?.featuresVariant || "slideshow";

  if (featuresVariant === "tileGrid") return null;

  return (
    <div className="relative h-10 bg-zinc-300">
      {variant === "centered" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span className="text-[7px] font-semibold" style={{ color: colors.text || "#18181b" }}>
            Welcome
          </span>
          <span
            className="mt-0.5 border px-1 text-[5px]"
            style={{ borderColor: colors.text || "#18181b" }}
          >
            CTA
          </span>
        </div>
      )}
      {variant === "overlayBoxLeft" && (
        <div
          className="absolute left-1 top-1/2 max-w-[55%] -translate-y-1/2 px-2 py-1"
          style={{ background: `${colors.primary}dd` }}
        >
          <span className="text-[7px] font-semibold text-white">Welcome</span>
        </div>
      )}
      {variant === "bottomGradient" && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
          <span className="text-[6px] text-white">Caption</span>
        </div>
      )}
    </div>
  );
}

function MiniModule({ theme }) {
  const { colors, fonts, structure } = theme;
  const variant = structure?.moduleVariant || "classic";

  const titleStyle =
    variant === "flatBar"
      ? { background: colors.primary, color: "#fff", padding: "2px 4px", fontSize: "7px" }
      : variant === "bordered"
        ? { borderLeft: `2px solid ${colors.accent}`, paddingLeft: "4px", color: colors.primary, fontSize: "8px" }
        : variant === "card"
          ? { fontSize: "8px", fontWeight: 600 }
          : { borderBottom: `1px solid ${colors.primary}`, fontSize: "8px", paddingBottom: "2px" };

  const wrapperStyle =
    variant === "card"
      ? { background: "#fff", borderRadius: "4px", boxShadow: "0 1px 3px rgb(0 0 0 / 0.1)", padding: "4px" }
      : variant === "bordered"
        ? { border: `1px solid ${colors.primary}44`, borderRadius: "2px", padding: "4px" }
        : {};

  return (
    <div className="px-2 py-1.5" style={wrapperStyle}>
      <p className="font-semibold leading-tight" style={{ ...titleStyle, fontFamily: fonts.heading }}>
        Welcome
      </p>
      <p className="mt-0.5 text-[7px] leading-tight opacity-60" style={{ fontFamily: fonts.body }}>
        Body text sample
      </p>
    </div>
  );
}

function MiniFooter({ theme }) {
  const { colors, structure } = theme;
  const variant = structure?.footerVariant || "lightColumns";

  const style =
    variant === "darkBand"
      ? { background: colors.secondary, height: "10px" }
      : variant === "accentBar"
        ? { background: colors.background || "#fff", borderTop: `2px solid ${colors.accent}`, height: "8px" }
        : variant === "minimalCenter"
          ? { background: colors.background || "#fafafa", height: "6px", borderTop: "1px solid #e5e5e5" }
          : { background: `${colors.secondary}22`, height: "10px" };

  return <div style={style} />;
}

export function ThemeMiniPreview({ theme }) {
  const headerVariant = theme.structure?.headerVariant || "centeredBanner";
  const navVariant = theme.structure?.navVariant || "barBelow";
  const headerTone = theme.structure?.headerTone || "dark";
  const featuresVariant = theme.structure?.featuresVariant || "slideshow";
  const inlineNav = headerVariant === "inlineNav";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <MiniHeader theme={theme} />
      {!inlineNav && (
        <MiniNav colors={theme.colors} fonts={theme.fonts} variant={navVariant} headerTone={headerTone} />
      )}
      {featuresVariant === "tileGrid" && <MiniFeatureTiles colors={theme.colors} />}
      <MiniHero theme={theme} />
      <MiniModule theme={theme} />
      <MiniFooter theme={theme} />
    </div>
  );
}
