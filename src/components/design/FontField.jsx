"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONT_PRESETS, isPresetFont } from "@/lib/design/font-presets";

function resolveSelectValue(value, allowDefault) {
  if (!value && allowDefault) return "__default__";
  if (value && isPresetFont(value)) return value;
  if (value) return "__custom__";
  return allowDefault ? "__default__" : "__custom__";
}

export function FontField({
  label,
  value,
  onChange,
  allowDefault = false,
  defaultLabel = "Theme default",
  id,
}) {
  const selectValue = resolveSelectValue(value, allowDefault);
  const showCustomInput = selectValue === "__custom__";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === "__default__") onChange("");
          else if (v !== "__custom__") onChange(v);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Choose a font" />
        </SelectTrigger>
        <SelectContent>
          {allowDefault && <SelectItem value="__default__">{defaultLabel}</SelectItem>}
          {FONT_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value} style={{ fontFamily: preset.value }}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Custom…</SelectItem>
        </SelectContent>
      </Select>
      {showCustomInput && (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Georgia, serif"
          className="text-sm"
        />
      )}
    </div>
  );
}
