"use client";

import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORM_FIELD_TYPES } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

export const FIELD_TYPE_LABELS = {
  heading: "Section heading",
  paragraph: "Paragraph text",
  text: "Short text",
  email: "Email",
  phone: "Phone",
  textarea: "Long text",
  select: "Dropdown",
  radio: "Radio buttons",
  checkbox: "Checkbox",
  date: "Date",
  file: "File upload",
};

const textareaClassName =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * @param {object} props
 * @param {import('@/lib/forms/schema.js').FormField} props.field
 * @param {number} [props.index]
 * @param {(patch: Partial<import('@/lib/forms/schema.js').FormField>) => void} props.onChange
 * @param {() => void} props.onRemove
 * @param {() => void} [props.onMoveUp]
 * @param {() => void} [props.onMoveDown]
 * @param {boolean} [props.canMoveUp]
 * @param {boolean} [props.canMoveDown]
 */
export function FormFieldEditor({
  field,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) {
  const isDisplay = field.type === "heading" || field.type === "paragraph";
  const hasOptions = field.type === "select" || field.type === "radio" || field.type === "checkbox";
  const typeLabel = FIELD_TYPE_LABELS[field.type] || field.type;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
        {typeof index === "number" && (
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {index + 1}
          </span>
        )}
        <Badge variant="secondary" className="h-5 font-normal">
          {typeLabel}
        </Badge>
        {field.required && !isDisplay && (
          <Badge variant="outline" className="h-5 font-normal text-red-600">
            Required
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="text-muted-foreground hover:text-red-600"
            aria-label="Remove field"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Field type</Label>
            <Select value={field.type} onValueChange={(v) => onChange({ type: v })}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {isDisplay ? "Display text" : "Label"}
            </Label>
            <Input
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder={isDisplay ? "Section heading or paragraph text" : "Field label"}
              className="h-9 bg-background"
            />
          </div>
        </div>

        {!isDisplay && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Placeholder</Label>
              <Input
                value={field.placeholder || ""}
                onChange={(e) => onChange({ placeholder: e.target.value })}
                className="h-9 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Help text</Label>
              <Input
                value={field.helpText || ""}
                onChange={(e) => onChange({ helpText: e.target.value })}
                className="h-9 bg-background"
              />
            </div>
          </div>
        )}

        {hasOptions && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Options (one per line)</Label>
            <textarea
              value={(field.options || []).join("\n")}
              onChange={(e) =>
                onChange({
                  options: e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                })
              }
              rows={3}
              className={textareaClassName}
              placeholder={"Option 1\nOption 2\nOption 3"}
            />
          </div>
        )}

        {field.type === "file" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Accepted types</Label>
              <Input
                value={field.accept || ""}
                onChange={(e) => onChange({ accept: e.target.value })}
                placeholder=".pdf,.doc,image/*"
                className="h-9 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Max size (MB)</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={field.maxFileSizeMb ?? 10}
                onChange={(e) => onChange({ maxFileSizeMb: Number(e.target.value) || 10 })}
                className="h-9 bg-background"
              />
            </div>
          </div>
        )}

        {!isDisplay && field.type !== "file" && (
          <label
            className={cn(
              "flex items-center gap-2.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm",
              field.type === "checkbox" && !field.options?.length && "hidden",
            )}
          >
            <input
              type="checkbox"
              checked={field.required === true}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Required field
          </label>
        )}

        {field.type === "checkbox" && !field.options?.length && (
          <label className="flex items-center gap-2.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={field.required === true}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Must be checked to submit
          </label>
        )}
      </div>
    </div>
  );
}
