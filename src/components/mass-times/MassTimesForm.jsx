"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateMassEntryId, normalizeMassTimes } from "@/lib/mass-times/schema";

const WEEKLY_FIELDS = [
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
  { key: "weekday", label: "Weekday" },
];

/**
 * @param {Object} props
 * @param {import('@/lib/mass-times/types').MassTimesConfig} props.value
 * @param {(value: import('@/lib/mass-times/types').MassTimesConfig) => void} props.onChange
 * @param {boolean} [props.readOnly]
 */
export function MassTimesForm({ value, onChange, readOnly = false }) {
  const times = normalizeMassTimes(value);
  const [activeTab, setActiveTab] = useState("weekly");

  const updateWeekly = (field, text) => {
    onChange({
      ...times,
      weekly: {
        ...times.weekly,
        [field]: text.split("\n").filter(Boolean),
      },
    });
  };

  const updateStringList = (field, text) => {
    onChange({
      ...times,
      [field]: text.split("\n").filter(Boolean),
    });
  };

  const updateHolidayList = (listKey, nextList) => {
    onChange({ ...times, [listKey]: nextList });
  };

  const addHoliday = (listKey) => {
    const entry =
      listKey === "special"
        ? { id: generateMassEntryId(), name: "", date: "", endDate: "", times: [], notes: "" }
        : { id: generateMassEntryId(), name: "", date: "", times: [], notes: "" };
    updateHolidayList(listKey, [...times[listKey], entry]);
  };

  const updateEntry = (listKey, index, field, fieldValue) => {
    const list = times[listKey].map((entry, i) =>
      i === index ? { ...entry, [field]: fieldValue } : entry,
    );
    updateHolidayList(listKey, list);
  };

  const updateEntryTimes = (listKey, index, text) => {
    updateEntry(listKey, index, "times", text.split("\n").filter(Boolean));
  };

  const removeEntry = (listKey, index) => {
    updateHolidayList(
      listKey,
      times[listKey].filter((_, i) => i !== index),
    );
  };

  const inputClass = "mt-1 w-full rounded border px-3 py-2 text-sm";
  const textareaClass = `${inputClass} font-mono text-xs`;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-4 w-full justify-start overflow-x-auto">
        <TabsTrigger value="weekly">Weekly</TabsTrigger>
        <TabsTrigger value="holyDays">Holy Days</TabsTrigger>
        <TabsTrigger value="holidays">Holidays</TabsTrigger>
        <TabsTrigger value="special">Special</TabsTrigger>
        <TabsTrigger value="adoration">Adoration</TabsTrigger>
        <TabsTrigger value="confession">Confession</TabsTrigger>
      </TabsList>

      <TabsContent value="weekly" className="space-y-4">
        {WEEKLY_FIELDS.map(({ key, label }) => (
          <label key={key} className="block text-sm">
            {label}
            <textarea
              value={(times.weekly[key] || []).join("\n")}
              onChange={(e) => updateWeekly(key, e.target.value)}
              rows={3}
              readOnly={readOnly}
              disabled={readOnly}
              className={textareaClass}
              placeholder="One time per line"
            />
          </label>
        ))}
      </TabsContent>

      <TabsContent value="holyDays">
        <label className="block text-sm">
          Holy days &amp; feast days
          <textarea
            value={(times.holyDays || []).join("\n")}
            onChange={(e) => updateStringList("holyDays", e.target.value)}
            rows={4}
            readOnly={readOnly}
            disabled={readOnly}
            className={textareaClass}
            placeholder="One time per line"
          />
        </label>
      </TabsContent>

      <TabsContent value="holidays">
        <EntryList
          entries={times.holidays}
          listKey="holidays"
          readOnly={readOnly}
          inputClass={inputClass}
          textareaClass={textareaClass}
          onUpdateEntry={updateEntry}
          onUpdateTimes={updateEntryTimes}
          onRemove={removeEntry}
          onAdd={() => addHoliday("holidays")}
        />
      </TabsContent>

      <TabsContent value="special">
        <EntryList
          entries={times.special}
          listKey="special"
          showEndDate
          readOnly={readOnly}
          inputClass={inputClass}
          textareaClass={textareaClass}
          onUpdateEntry={updateEntry}
          onUpdateTimes={updateEntryTimes}
          onRemove={removeEntry}
          onAdd={() => addHoliday("special")}
        />
      </TabsContent>

      <TabsContent value="adoration">
        <label className="block text-sm">
          Adoration times
          <textarea
            value={(times.adoration || []).join("\n")}
            onChange={(e) => updateStringList("adoration", e.target.value)}
            rows={4}
            readOnly={readOnly}
            disabled={readOnly}
            className={textareaClass}
            placeholder="One time per line"
          />
        </label>
      </TabsContent>

      <TabsContent value="confession">
        <label className="block text-sm">
          Confession times
          <textarea
            value={(times.confession || []).join("\n")}
            onChange={(e) => updateStringList("confession", e.target.value)}
            rows={4}
            readOnly={readOnly}
            disabled={readOnly}
            className={textareaClass}
            placeholder="One time per line"
          />
        </label>
      </TabsContent>
    </Tabs>
  );
}

function EntryList({
  entries,
  listKey,
  showEndDate = false,
  readOnly,
  inputClass,
  textareaClass,
  onUpdateEntry,
  onUpdateTimes,
  onRemove,
  onAdd,
}) {
  if (!entries.length && readOnly) {
    return <p className="text-sm text-muted-foreground">No entries.</p>;
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={entry.id || i} className="space-y-3 rounded border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {showEndDate ? "Special mass" : "Holiday"} {i + 1}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemove(listKey, i)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={entry.name}
              onChange={(e) => onUpdateEntry(listKey, i, "name", e.target.value)}
              placeholder="e.g. Christmas"
              readOnly={readOnly}
              disabled={readOnly}
              className={inputClass}
            />
          </div>
          <div className={`grid gap-3 ${showEndDate ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={entry.date}
                onChange={(e) => onUpdateEntry(listKey, i, "date", e.target.value)}
                readOnly={readOnly}
                disabled={readOnly}
                className={inputClass}
              />
            </div>
            {showEndDate && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">End date (optional)</Label>
                <Input
                  type="date"
                  value={entry.endDate || ""}
                  onChange={(e) => onUpdateEntry(listKey, i, "endDate", e.target.value)}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className={inputClass}
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Times</Label>
            <textarea
              value={(entry.times || []).join("\n")}
              onChange={(e) => onUpdateTimes(listKey, i, e.target.value)}
              rows={3}
              readOnly={readOnly}
              disabled={readOnly}
              className={textareaClass}
              placeholder="One time per line"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Input
              value={entry.notes || ""}
              onChange={(e) => onUpdateEntry(listKey, i, "notes", e.target.value)}
              placeholder="Additional details"
              readOnly={readOnly}
              disabled={readOnly}
              className={inputClass}
            />
          </div>
        </div>
      ))}
      {!readOnly && (
        <button type="button" onClick={onAdd} className="text-sm text-primary hover:underline">
          + Add {showEndDate ? "special mass" : "holiday"}
        </button>
      )}
    </div>
  );
}
