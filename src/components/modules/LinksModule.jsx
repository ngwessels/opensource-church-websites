import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function LinksModule({ module }) {
  const { title, items = [] } = module.config || {};
  return (
    <section>
      {title && (
        <h2 className="site-module-title text-base font-semibold">{title}</h2>
      )}
      <ul className="divide-y divide-current/10">
        {items.map((item, i) => {
          const inner = (
            <>
              <span>{item.label}</span>
              <ChevronRight className="h-4 w-4 opacity-40" />
            </>
          );
          const className =
            "flex items-center justify-between py-2.5 text-sm transition-colors hover:text-[var(--site-accent,var(--site-primary))]";
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
