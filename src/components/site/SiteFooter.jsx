import Link from "next/link";

export function SiteFooter({ siteConfig }) {
  const footer = siteConfig?.footerConfig || {};
  const columns = footer.columns || [];
  const year = new Date().getFullYear();
  const name = siteConfig?.name || "Parish";

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50">
      {columns.length > 0 && (
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col, i) => (
            <div key={i}>
              {col.title && (
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-800">
                  {col.title}
                </h3>
              )}
              {col.html && (
                <div
                  className="prose prose-sm max-w-none text-zinc-600"
                  dangerouslySetInnerHTML={{ __html: col.html }}
                />
              )}
              {col.links?.length > 0 && (
                <ul className="space-y-2">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <Link
                        href={link.href || "#"}
                        className="text-sm text-zinc-600 hover:text-[var(--site-primary)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
        {footer.text || `© ${year} ${name}. All rights reserved.`}
      </div>
    </footer>
  );
}
