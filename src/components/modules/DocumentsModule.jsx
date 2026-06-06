import { FileText } from "lucide-react";

export function DocumentsModule({ module }) {
  const { title, items = [] } = module.config || {};
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {title && (
        <h2 className="mb-3 text-base font-semibold text-zinc-900">{title}</h2>
      )}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            <a
              href={item.url}
              className="flex items-center gap-2 text-sm text-zinc-700 hover:text-[var(--site-primary)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
