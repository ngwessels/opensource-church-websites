"use client";

import { SectionOverlay } from "@/components/builder/SectionOverlay";
import { SocialMediaLinks } from "@/components/site/SocialMediaLinks";

import { HeaderBrand } from "./HeaderBrand";
import { NavBar } from "./NavBar";
import { QuickLinks } from "./QuickLinks";

function HeaderSocialMedia({ socialMedia, headerStyles }) {
  if (socialMedia?.showInHeader === false) return null;
  return (
    <SocialMediaLinks
      socialMedia={socialMedia}
      variant="header"
      color={headerStyles.titleColor}
    />
  );
}

function HeaderTitleSection({
  siteConfig,
  headerStyles,
  layout,
  compact,
  editing,
  onHeaderSettings,
  children,
  className = "",
}) {
  const name = siteConfig?.name || "Parish";
  const tagline = siteConfig?.tagline || "";
  const headerConfig = siteConfig?.headerConfig || {};
  const showTagline = headerConfig.showTagline !== false;
  const showLogo = headerConfig.showLogo && headerConfig.logoUrl;

  return (
    <div
      className={`site-header-band relative px-4 ${className}`}
      style={{
        backgroundColor: headerStyles.headerBackground,
        paddingTop: "var(--site-header-py, 2rem)",
        paddingBottom: "var(--site-header-py, 2rem)",
      }}
    >
      {editing && (
        <SectionOverlay label="TITLE" onClick={() => onHeaderSettings?.("title")} />
      )}
      <div
        className={`site-header-inner mx-auto flex max-w-6xl items-center gap-6 ${
          layout === "centered" ? "flex-col justify-center text-center" : "text-left"
        }`}
      >
        <HeaderBrand
          name={name}
          tagline={tagline}
          showLogo={showLogo}
          showTagline={showTagline}
          logoUrl={headerConfig.logoUrl}
          headerStyles={headerStyles}
          layout={layout}
          compact={compact}
        />
        {children}
      </div>
    </div>
  );
}

function HeaderWithQuickLinks({ quickLinksVariant, quickLinks, navNodes, headerStyles, editing, children }) {
  return (
    <>
      {quickLinksVariant === "utilityBar" && (
        <QuickLinks
          quickLinks={quickLinks}
          navNodes={navNodes}
          headerStyles={headerStyles}
          editing={editing}
          variant="utilityBar"
        />
      )}
      {children}
    </>
  );
}

function InlineQuickLinks(props) {
  const { quickLinksVariant = "inline", ...rest } = props;
  if (quickLinksVariant === "utilityBar") return null;
  return (
    <QuickLinks
      {...rest}
      variant={quickLinksVariant === "boxedCta" ? "boxedCta" : "inline"}
    />
  );
}

export function CenteredBannerHeader(props) {
  const {
    displayNavTree,
    navNodes,
    navStyle,
    headerStyles,
    editing,
    onHeaderSettings,
    siteConfig,
    quickLinks,
    quickLinksVariant = "inline",
  } = props;

  return (
    <>
      <header id="header" className="relative">
        <HeaderWithQuickLinks
          quickLinksVariant={quickLinksVariant}
          quickLinks={quickLinks}
          navNodes={navNodes}
          headerStyles={headerStyles}
          editing={editing}
        >
          <InlineQuickLinks
            quickLinks={quickLinks}
            navNodes={navNodes}
            headerStyles={headerStyles}
            editing={editing}
            quickLinksVariant={quickLinksVariant}
          />
          <HeaderSocialMedia socialMedia={siteConfig?.socialMedia} headerStyles={headerStyles} />
          <HeaderTitleSection
            siteConfig={siteConfig}
            headerStyles={headerStyles}
            layout="centered"
            editing={editing}
            onHeaderSettings={onHeaderSettings}
          />
        </HeaderWithQuickLinks>
      </header>
      <NavBar
        displayNavTree={displayNavTree}
        navNodes={navNodes}
        headerStyles={headerStyles}
        navStyle={navStyle}
        editing={editing}
        onHeaderSettings={onHeaderSettings}
        siteName={siteConfig?.name || "Parish"}
        quickLinks={quickLinks}
        previewViewport={props.previewViewport}
      />
    </>
  );
}

export function LogoLeftStackHeader(props) {
  const { displayNavTree, navNodes, navStyle, headerStyles, editing, onHeaderSettings, siteConfig, quickLinks } =
    props;

  return (
    <>
      <header id="header" className="relative">
        <QuickLinks
          quickLinks={quickLinks}
          navNodes={navNodes}
          headerStyles={headerStyles}
          editing={editing}
        />
        <HeaderSocialMedia socialMedia={siteConfig?.socialMedia} headerStyles={headerStyles} />
        <HeaderTitleSection
          siteConfig={siteConfig}
          headerStyles={headerStyles}
          layout="logoLeft"
          editing={editing}
          onHeaderSettings={onHeaderSettings}
        />
      </header>
      <NavBar
        displayNavTree={displayNavTree}
        navNodes={navNodes}
        headerStyles={headerStyles}
        navStyle={navStyle}
        editing={editing}
        onHeaderSettings={onHeaderSettings}
        siteName={siteConfig?.name || "Parish"}
        quickLinks={quickLinks}
        previewViewport={props.previewViewport}
      />
    </>
  );
}

export function InlineNavHeader(props) {
  const { displayNavTree, navNodes, headerStyles, editing, onHeaderSettings, siteConfig, quickLinks } = props;

  return (
    <header id="header" className="relative">
      <QuickLinks
        quickLinks={quickLinks}
        navNodes={navNodes}
        headerStyles={headerStyles}
        editing={editing}
      />
      <HeaderSocialMedia socialMedia={siteConfig?.socialMedia} headerStyles={headerStyles} />
      <div
        className="site-header-band site-header-inline relative px-4"
        style={{
          backgroundColor: headerStyles.headerBackground,
          paddingTop: "var(--site-header-py, 1.25rem)",
          paddingBottom: "var(--site-header-py, 1.25rem)",
        }}
      >
        {editing && (
          <SectionOverlay label="TITLE" onClick={() => onHeaderSettings?.("title")} />
        )}
        <div className="site-header-inline mx-auto max-w-6xl">
          <HeaderBrand
            name={siteConfig?.name || "Parish"}
            tagline={siteConfig?.tagline || ""}
            showLogo={siteConfig?.headerConfig?.showLogo && siteConfig?.headerConfig?.logoUrl}
            showTagline={siteConfig?.headerConfig?.showTagline !== false}
            logoUrl={siteConfig?.headerConfig?.logoUrl}
            headerStyles={headerStyles}
            layout="inline"
            compact
          />
          <NavBar
            displayNavTree={displayNavTree}
            navNodes={navNodes}
            headerStyles={headerStyles}
            navStyle="solid"
            editing={editing}
            onHeaderSettings={onHeaderSettings}
            siteName={siteConfig?.name || "Parish"}
            quickLinks={quickLinks}
            previewViewport={props.previewViewport}
            inline
          />
        </div>
      </div>
      {editing && (
        <SectionOverlay label="NAV" onClick={() => onHeaderSettings?.("nav")} />
      )}
    </header>
  );
}

export function MinimalBarHeader(props) {
  const { displayNavTree, navNodes, navStyle, headerStyles, editing, onHeaderSettings, siteConfig, quickLinks } =
    props;

  return (
    <>
      <header id="header" className="relative">
        <QuickLinks
          quickLinks={quickLinks}
          navNodes={navNodes}
          headerStyles={headerStyles}
          editing={editing}
        />
        <HeaderSocialMedia socialMedia={siteConfig?.socialMedia} headerStyles={headerStyles} />
        <HeaderTitleSection
          siteConfig={siteConfig}
          headerStyles={headerStyles}
          layout="logoLeft"
          compact
          editing={editing}
          onHeaderSettings={onHeaderSettings}
          className="border-b border-white/10"
        />
      </header>
      <NavBar
        displayNavTree={displayNavTree}
        navNodes={navNodes}
        headerStyles={headerStyles}
        navStyle={navStyle}
        editing={editing}
        onHeaderSettings={onHeaderSettings}
        siteName={siteConfig?.name || "Parish"}
        quickLinks={quickLinks}
        previewViewport={props.previewViewport}
      />
    </>
  );
}

export function HeroBandHeader(props) {
  const { displayNavTree, navNodes, navStyle, headerStyles, editing, onHeaderSettings, siteConfig, quickLinks } =
    props;

  return (
    <>
      <header id="header" className="relative">
        <QuickLinks
          quickLinks={quickLinks}
          navNodes={navNodes}
          headerStyles={headerStyles}
          editing={editing}
        />
        <HeaderSocialMedia socialMedia={siteConfig?.socialMedia} headerStyles={headerStyles} />
        <HeaderTitleSection
          siteConfig={siteConfig}
          headerStyles={headerStyles}
          layout="centered"
          editing={editing}
          onHeaderSettings={onHeaderSettings}
          className="shadow-md"
        />
      </header>
      <NavBar
        displayNavTree={displayNavTree}
        navNodes={navNodes}
        headerStyles={headerStyles}
        navStyle={navStyle}
        editing={editing}
        onHeaderSettings={onHeaderSettings}
        siteName={siteConfig?.name || "Parish"}
        quickLinks={quickLinks}
        previewViewport={props.previewViewport}
      />
    </>
  );
}

export function LightLogoLeftHeader(props) {
  const {
    displayNavTree,
    navNodes,
    navStyle,
    headerStyles,
    editing,
    onHeaderSettings,
    siteConfig,
    quickLinks,
    quickLinksVariant = "boxedCta",
  } = props;

  return (
    <>
      <header id="header" className="relative">
        <HeaderWithQuickLinks
          quickLinksVariant={quickLinksVariant}
          quickLinks={quickLinks}
          navNodes={navNodes}
          headerStyles={headerStyles}
          editing={editing}
        >
          <InlineQuickLinks
            quickLinks={quickLinks}
            navNodes={navNodes}
            headerStyles={headerStyles}
            editing={editing}
            quickLinksVariant={quickLinksVariant}
          />
          <HeaderSocialMedia socialMedia={siteConfig?.socialMedia} headerStyles={headerStyles} />
          <HeaderTitleSection
            siteConfig={siteConfig}
            headerStyles={headerStyles}
            layout="logoLeft"
            editing={editing}
            onHeaderSettings={onHeaderSettings}
          />
        </HeaderWithQuickLinks>
      </header>
      <NavBar
        displayNavTree={displayNavTree}
        navNodes={navNodes}
        headerStyles={headerStyles}
        navStyle={navStyle}
        editing={editing}
        onHeaderSettings={onHeaderSettings}
        siteName={siteConfig?.name || "Parish"}
        quickLinks={quickLinks}
        previewViewport={props.previewViewport}
      />
    </>
  );
}

export function LightCenteredHeader(props) {
  const {
    displayNavTree,
    navNodes,
    navStyle,
    headerStyles,
    editing,
    onHeaderSettings,
    siteConfig,
    quickLinks,
    quickLinksVariant = "utilityBar",
  } = props;

  return (
    <>
      <HeaderWithQuickLinks
        quickLinksVariant={quickLinksVariant}
        quickLinks={quickLinks}
        navNodes={navNodes}
        headerStyles={headerStyles}
        editing={editing}
      >
        <header id="header" className="relative">
          <InlineQuickLinks
            quickLinks={quickLinks}
            navNodes={navNodes}
            headerStyles={headerStyles}
            editing={editing}
            quickLinksVariant={quickLinksVariant}
          />
          <HeaderSocialMedia socialMedia={siteConfig?.socialMedia} headerStyles={headerStyles} />
          <HeaderTitleSection
            siteConfig={siteConfig}
            headerStyles={headerStyles}
            layout="centered"
            editing={editing}
            onHeaderSettings={onHeaderSettings}
          />
        </header>
      </HeaderWithQuickLinks>
      <NavBar
        displayNavTree={displayNavTree}
        navNodes={navNodes}
        headerStyles={headerStyles}
        navStyle={navStyle}
        editing={editing}
        onHeaderSettings={onHeaderSettings}
        siteName={siteConfig?.name || "Parish"}
        quickLinks={quickLinks}
        previewViewport={props.previewViewport}
      />
    </>
  );
}

const HEADER_VARIANTS = {
  centeredBanner: CenteredBannerHeader,
  logoLeftStack: LogoLeftStackHeader,
  inlineNav: InlineNavHeader,
  minimalBar: MinimalBarHeader,
  heroBand: HeroBandHeader,
  lightLogoLeft: LightLogoLeftHeader,
  lightCentered: LightCenteredHeader,
};

export function renderHeaderVariant(variant, props) {
  const Component = HEADER_VARIANTS[variant] || CenteredBannerHeader;
  return <Component {...props} />;
}
