import Image from "next/image";
import { User } from "lucide-react";

export function PeopleModule({ module }) {
  const { title, people = [] } = module.config || {};
  return (
    <section>
      {title && (
        <h2 className="mb-4 border-b-2 border-[var(--site-primary)] pb-2 text-xl font-semibold text-zinc-900">
          {title}
        </h2>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {people.map((person, i) => (
          <div
            key={person.id || i}
            className="flex gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100">
              {person.photoUrl ? (
                <Image src={person.photoUrl} alt="" fill className="object-cover" unoptimized />
              ) : (
                <User className="h-8 w-8 text-zinc-400" />
              )}
            </div>
            <div>
              <p className="font-semibold text-zinc-900">{person.name}</p>
              {person.role && <p className="text-sm text-zinc-600">{person.role}</p>}
              {person.email && (
                <a
                  href={`mailto:${person.email}`}
                  className="mt-1 inline-block text-sm text-[var(--site-primary)] hover:underline"
                >
                  {person.email}
                </a>
              )}
              {person.phone && (
                <a
                  href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}
                  className="mt-1 block text-sm text-[var(--site-primary)] hover:underline"
                >
                  {person.phone}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
