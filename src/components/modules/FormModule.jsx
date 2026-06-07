"use client";

import { useState } from "react";

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
import { DISPLAY_FIELD_TYPES, normalizeFormConfig } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

/**
 * @param {object} props
 * @param {{ config?: import('@/lib/forms/schema.js').FormModuleConfig }} props.module
 * @param {boolean} [props.editing]
 * @param {boolean} [props.preview]
 */
export function FormModule({ module, editing = false, preview = false }) {
  const config = normalizeFormConfig(module?.config);
  const [status, setStatus] = useState(/** @type {'idle' | 'loading' | 'success' | 'error'} */ ("idle"));
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState(/** @type {Record<string, string>} */ ({}));
  /** @type {[Record<string, string | string[]>, (v: Record<string, string | string[]>) => void]} */
  const [values, setValues] = useState({});

  const inputFields = config.fields.filter((f) => !DISPLAY_FIELD_TYPES.has(f.type));

  async function handleSubmit(event) {
    event.preventDefault();
    if (editing) return;

    setStatus("loading");
    setErrorMessage("");
    setFieldErrors({});

    const formData = new FormData();
    formData.set("formId", config.formId);
    formData.set(config.honeypotFieldName, "");

    for (const field of inputFields) {
      if (field.type === "file") {
        const input = document.getElementById(`form-field-${field.id}`);
        if (input instanceof HTMLInputElement && input.files?.[0]) {
          formData.set(field.id, input.files[0]);
        }
        continue;
      }

      const raw = values[field.id];
      if (field.type === "checkbox" && field.options && field.options.length > 0) {
        const selected = Array.isArray(raw) ? raw : [];
        for (const item of selected) {
          formData.append(field.id, item);
        }
        continue;
      }

      if (field.type === "checkbox") {
        if (values[field.id]) {
          formData.set(field.id, "true");
        }
        continue;
      }

      if (raw !== undefined && raw !== null && raw !== "") {
        formData.set(field.id, String(raw));
      }
    }

    try {
      const response = await fetch("/api/forms/submit", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }
        throw new Error(data.error ?? "Submission failed.");
      }

      setStatus("success");
      setValues({});
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Submission failed.");
    }
  }

  function updateValue(fieldId, value) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function toggleCheckboxOption(fieldId, option, checked) {
    setValues((prev) => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      const next = checked
        ? [...current, option]
        : current.filter((v) => v !== option);
      return { ...prev, [fieldId]: next };
    });
  }

  if (status === "success") {
    return (
      <section
        className={cn(
          "rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-900",
          preview && "border-emerald-100 shadow-sm",
        )}
      >
        <p className="font-medium">{config.successMessage}</p>
      </section>
    );
  }

  const formContent = (
    <>
      {config.title && (
        <h2
          className={cn(
            "mb-2 border-b-2 border-[var(--site-primary)] pb-2 text-xl font-semibold text-zinc-900",
            preview && "text-lg",
          )}
        >
          {config.title}
        </h2>
      )}
      {config.description && (
        <p className="mb-4 text-sm leading-relaxed text-zinc-600">{config.description}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Honeypot — hidden from users */}
        <input
          type="text"
          name={config.honeypotFieldName}
          tabIndex={-1}
          autoComplete="off"
          className="absolute h-0 w-0 overflow-hidden opacity-0"
          aria-hidden
        />

        {config.fields.map((field) => {
          if (field.type === "heading") {
            return (
              <h3 key={field.id} className="pt-2 text-lg font-semibold text-zinc-900">
                {field.label}
              </h3>
            );
          }

          if (field.type === "paragraph") {
            return (
              <p key={field.id} className="text-sm text-zinc-600">
                {field.label}
              </p>
            );
          }

          const err = fieldErrors[field.id];

          return (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`form-field-${field.id}`} className="text-zinc-800">
                {field.label}
                {field.required && <span className="ml-0.5 text-red-600">*</span>}
              </Label>

              {field.type === "textarea" ? (
                <textarea
                  id={`form-field-${field.id}`}
                  value={typeof values[field.id] === "string" ? values[field.id] : ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={editing || status === "loading"}
                  rows={4}
                  className={cn(
                    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
                    err && "border-red-500",
                  )}
                />
              ) : field.type === "select" ? (
                <Select
                  value={typeof values[field.id] === "string" ? values[field.id] : ""}
                  onValueChange={(v) => updateValue(field.id, v)}
                  disabled={editing || status === "loading"}
                >
                  <SelectTrigger id={`form-field-${field.id}`} className={cn(err && "border-red-500")}>
                    <SelectValue placeholder={field.placeholder || "Select…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options || []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "radio" ? (
                <div className="space-y-2" role="radiogroup" aria-labelledby={`form-field-${field.id}`}>
                  {(field.options || []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="radio"
                        name={field.id}
                        value={opt}
                        checked={values[field.id] === opt}
                        onChange={() => updateValue(field.id, opt)}
                        disabled={editing || status === "loading"}
                        className="h-4 w-4 accent-[var(--site-primary)]"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : field.type === "checkbox" && field.options && field.options.length > 0 ? (
                <div className="space-y-2">
                  {field.options.map((opt) => {
                    const selected = Array.isArray(values[field.id]) ? values[field.id] : [];
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={selected.includes(opt)}
                          onChange={(e) => toggleCheckboxOption(field.id, opt, e.target.checked)}
                          disabled={editing || status === "loading"}
                          className="h-4 w-4 accent-[var(--site-primary)]"
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              ) : field.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    id={`form-field-${field.id}`}
                    type="checkbox"
                    checked={values[field.id] === true || values[field.id] === "true"}
                    onChange={(e) => updateValue(field.id, e.target.checked)}
                    disabled={editing || status === "loading"}
                    className="h-4 w-4 accent-[var(--site-primary)]"
                  />
                  {field.placeholder || field.label}
                </label>
              ) : field.type === "file" ? (
                <Input
                  id={`form-field-${field.id}`}
                  type="file"
                  accept={field.accept}
                  required={field.required}
                  disabled={editing || status === "loading"}
                  className={cn(err && "border-red-500")}
                />
              ) : (
                <Input
                  id={`form-field-${field.id}`}
                  type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "date" ? "date" : "text"}
                  value={typeof values[field.id] === "string" ? values[field.id] : ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={editing || status === "loading"}
                  className={cn(err && "border-red-500")}
                />
              )}

              {field.helpText && !err && (
                <p className="text-xs text-zinc-500">{field.helpText}</p>
              )}
              {err && <p className="text-xs text-red-600">{err}</p>}
            </div>
          );
        })}

        {errorMessage && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        )}

        {editing && !preview && (
          <p className="text-xs text-zinc-500 italic">Preview only — publish the page to accept submissions.</p>
        )}

        <Button
          type="submit"
          disabled={editing || status === "loading"}
          className={cn(
            "bg-[var(--site-primary)] text-white hover:opacity-90",
            preview && "pointer-events-none",
          )}
        >
          {status === "loading" ? "Submitting…" : config.submitLabel}
        </Button>
      </form>
    </>
  );

  if (preview) {
    return <div className="site-module">{formContent}</div>;
  }

  return <section className="max-w-lg">{formContent}</section>;
}
