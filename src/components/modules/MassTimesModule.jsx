import { Church } from "lucide-react";

import {
  formatMassDateRange,
  resolveMassTimes,
  sortMassTimes,
} from "@/lib/mass-times/schema";

export function MassTimesModule({ module, siteConfig }) {
  const times = sortMassTimes(resolveMassTimes(module, siteConfig));
  const title = module.config?.title || "Mass Times";

  const weeklySections = [
    { label: "Saturday", items: times.weekly.saturday },
    { label: "Sunday", items: times.weekly.sunday },
    { label: "Weekday", items: times.weekly.weekday },
  ].filter((s) => s.items?.length);

  const holidaySections = times.holidays
    .filter((h) => h.name || h.times?.length)
    .map((h) => ({
      label: h.name || "Holiday",
      sublabel: formatMassDateRange(h.date, h.endDate),
      items: h.times,
      notes: h.notes,
    }));

  const specialSections = times.special
    .filter((s) => s.name || s.times?.length)
    .map((s) => ({
      label: s.name || "Special Mass",
      sublabel: formatMassDateRange(s.date, s.endDate),
      items: s.times,
      notes: s.notes,
    }));

  const holyDaysSection = times.holyDays?.length
    ? [{ label: "Holy Days & Feast Days", items: times.holyDays }]
    : [];

  const adorationSection = times.adoration?.length
    ? [{ label: "Adoration", items: times.adoration }]
    : [];

  const confessionSection = times.confession?.length
    ? [{ label: "Confession", items: times.confession }]
    : [];

  const renderSection = (s) => (
    <tr key={`${s.label}-${s.sublabel || ""}`} className="border-t border-zinc-100 first:border-t-0">
      <td className="py-2 pr-4 align-top font-medium text-zinc-900">
        <div>{s.label}</div>
        {s.sublabel && <div className="text-xs font-normal text-zinc-500">{s.sublabel}</div>}
      </td>
      <td className="py-2">
        <ul className="space-y-0.5">
          {s.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        {s.notes && <p className="mt-1 text-xs text-zinc-500">{s.notes}</p>}
      </td>
    </tr>
  );

  const hasContent =
    weeklySections.length ||
    holyDaysSection.length ||
    holidaySections.length ||
    specialSections.length ||
    adorationSection.length ||
    confessionSection.length;

  if (!hasContent) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Church className="h-5 w-5 text-[var(--site-primary)]" />
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      </div>
      <table className="w-full text-sm text-zinc-700">
        <tbody>
          {weeklySections.map(renderSection)}
          {holyDaysSection.map(renderSection)}
          {holidaySections.length > 0 && (
            <tr className="border-t border-zinc-100">
              <td colSpan={2} className="py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Holidays
              </td>
            </tr>
          )}
          {holidaySections.map(renderSection)}
          {specialSections.length > 0 && (
            <tr className="border-t border-zinc-100">
              <td colSpan={2} className="py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Special Masses
              </td>
            </tr>
          )}
          {specialSections.map(renderSection)}
          {adorationSection.map(renderSection)}
          {confessionSection.map(renderSection)}
        </tbody>
      </table>
    </section>
  );
}
