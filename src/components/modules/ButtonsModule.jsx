import Link from "next/link";

export function ButtonsModule({ module }) {
  const { items = [] } = module.config || {};
  return (
    <section className="flex flex-wrap gap-3">
      {items.map((item, i) => {
        const className =
          "site-button inline-flex items-center border-2 border-[var(--site-accent,var(--site-primary))] bg-[var(--site-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90";
        if (item.href?.startsWith("http")) {
          return (
            <a key={i} href={item.href} className={className} target="_blank" rel="noopener noreferrer">
              {item.label}
            </a>
          );
        }
        return (
          <Link key={i} href={item.href || "#"} className={className}>
            {item.label}
          </Link>
        );
      })}
    </section>
  );
}
