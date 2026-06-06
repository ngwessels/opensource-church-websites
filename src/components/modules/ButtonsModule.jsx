import Link from "next/link";

export function ButtonsModule({ module }) {
  const { items = [] } = module.config || {};
  return (
    <section className="flex flex-wrap gap-3">
      {items.map((item, i) => {
        const className =
          "inline-flex items-center rounded-md border-2 border-[var(--site-accent,var(--site-primary,#7f1d1d))] bg-[var(--site-primary,#7f1d1d)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90";
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
