import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function LinksModule({ module }) {
  const { title, items = [] } = module.config || {};
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {title && (
        <h2 className="mb-3 text-base font-semibold text-zinc-900">{title}</h2>
      )}
      <ul className="divide-y divide-zinc-100">
        {items.map((item, i) => {
          const inner = (
            <>
              <span>{item.label}</span>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </>
          );
          const className =
            "flex items-center justify-between py-2.5 text-sm text-zinc-700 transition-colors hover:text-[var(--site-accent,var(--site-primary))]";
          return (
            <li key={i}>
              {item.href?.startsWith("http") ? (
                <a href={item.href} className={className} target="_blank" rel="noopener noreferrer">
                  {inner}
                </a>
              ) : (
                <Link href={item.href || "#"} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
