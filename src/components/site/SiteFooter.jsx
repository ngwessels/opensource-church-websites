import Link from "next/link";

import { toBuilderHref } from "@/lib/builder/navigation";
import { resolveFooterStyles } from "@/lib/site/footer-styles";
import { isExternalHref, resolveFooterColumns } from "@/lib/sitemap/tree";

import { SocialMediaLinks } from "./SocialMediaLinks";

const FOOTER_CLASS = {
  lightColumns: "site-footer--lightColumns",
  darkBand: "site-footer--darkBand",
  minimalCenter: "site-footer--minimalCenter",
  accentBar: "site-footer--accentBar",
};

function FooterLink({ href, label, linkStyle, editing }) {
  const resolvedHref = toBuilderHref(href, editing);
  const external = isExternalHref(resolvedHref);

  if (external) {
    return (
      <a
        href={resolvedHref}
        className="site-footer-link text-sm hover:text-[var(--site-accent)]"
        style={linkStyle}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={resolvedHref}
      className="site-footer-link text-sm hover:text-[var(--site-accent)]"
      style={linkStyle}
    >
      {label}
    </Link>
  );
}

export function SiteFooter({
  siteConfig,
  footerVariant = "lightColumns",
  quickLinks = [],
  navNodes = [],
  editing = false,
}) {
  const footer = siteConfig?.footerConfig || {};
  const columns = resolveFooterColumns(footer.columns, quickLinks, navNodes);
  const year = new Date().getFullYear();
  const name = siteConfig?.name || "Parish";
  const variantClass = FOOTER_CLASS[footerVariant] || FOOTER_CLASS.lightColumns;
  const styles = resolveFooterStyles(footer, siteConfig?.design);

  const footerStyle = {
    ...(styles.footerBackground ? { backgroundColor: styles.footerBackground } : {}),
    ...(styles.textColor ? { color: styles.textColor } : {}),
  };

  const headingStyle = {
    ...(styles.headingColor ? { color: styles.headingColor } : {}),
    fontFamily: styles.headingFont,
    fontWeight: styles.headingFontWeight,
    ...(styles.headingFontSize ? { fontSize: styles.headingFontSize } : {}),
  };

  const bodyStyle = {
    ...(styles.textColor ? { color: styles.textColor } : {}),
    fontFamily: styles.bodyFont,
    ...(styles.bodyFontSize ? { fontSize: styles.bodyFontSize } : {}),
  };

  const linkStyle = {
    ...(styles.linkColor ? { color: styles.linkColor } : {}),
    fontFamily: styles.linkFont,
    ...(styles.linkFontSize ? { fontSize: styles.linkFontSize } : {}),
  };

  const copyrightStyle = {
    ...(styles.copyrightColor ? { color: styles.copyrightColor } : {}),
    fontFamily: styles.bodyFont,
    ...(styles.copyrightFontSize
      ? { fontSize: styles.copyrightFontSize }
      : styles.bodyFontSize
        ? { fontSize: styles.bodyFontSize }
        : {}),
  };

  return (
    <footer className={`site-footer ${variantClass}`} style={footerStyle}>
      {columns.length > 0 && (
        <div className="site-content-inner mx-auto grid gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col, i) => (
            <div key={i}>
              {col.title && (
                <h3
                  className="site-footer-heading mb-3 text-sm font-semibold uppercase tracking-wide"
                  style={headingStyle}
                >
                  {col.title}
                </h3>
              )}
              {col.html && (
                <div
                  className="prose prose-sm max-w-none opacity-80"
                  style={bodyStyle}
                  dangerouslySetInnerHTML={{ __html: col.html }}
                />
              )}
              {col.links?.length > 0 && (
                <ul className="space-y-2">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <FooterLink
                        href={link.href || "#"}
                        label={link.label}
                        linkStyle={linkStyle}
                        editing={editing}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {siteConfig?.socialMedia?.showInFooter !== false && (
        <SocialMediaLinks
          socialMedia={siteConfig.socialMedia}
          variant="footer"
          color={styles.linkColor || styles.textColor}
        />
      )}
      <div
        className="border-t border-current/10 px-4 py-6 text-center text-sm opacity-75"
        style={copyrightStyle}
      >
        {footer.text || `© ${year} ${name}. All rights reserved.`}
      </div>
    </footer>
  );
}
