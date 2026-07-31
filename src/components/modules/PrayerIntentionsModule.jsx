"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SUCCESS_MESSAGE,
  normalizePrayerIntentionsConfig,
} from "@/lib/prayer-intentions/schema";
import { cn } from "@/lib/utils";

/**
 * @param {object} props
 * @param {{ config?: import('@/lib/prayer-intentions/schema').PrayerIntentionsModuleConfig }} props.module
 * @param {boolean} [props.editing]
 * @param {boolean} [props.preview]
 */
export function PrayerIntentionsModule({ module, editing = false, preview = false }) {
  const config = normalizePrayerIntentionsConfig(module?.config);
  const [status, setStatus] = useState(/** @type {'idle' | 'loading' | 'success' | 'error'} */ ("idle"));
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [intention, setIntention] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

  const submitDisabled = editing || status === "loading";

  async function handleSubmit(event) {
    event.preventDefault();
    if (editing) return;

    setStatus("loading");
    setErrorMessage("");
    setFieldErrors({});

    const formData = new FormData();
    formData.set("moduleInstanceId", config.moduleInstanceId);
    formData.set(config.honeypotFieldName, "");
    formData.set("name", name);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("intention", intention);

    try {
      const response = await fetch("/api/prayer-intentions/submit", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
          if (data.errors.name || data.errors.email || data.errors.phone) {
            setContactOpen(true);
          }
        }
        throw new Error(data.error ?? "Submission failed.");
      }

      setStatus("success");
      setName("");
      setEmail("");
      setPhone("");
      setIntention("");
      setContactOpen(false);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Submission failed.");
    }
  }

  if (status === "success") {
    return (
      <section
        className={cn(
          "rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-900",
          preview && "border-emerald-100 shadow-sm",
        )}
      >
        <p className="font-medium">{DEFAULT_SUCCESS_MESSAGE}</p>
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
        <input
          type="text"
          name={config.honeypotFieldName}
          tabIndex={-1}
          autoComplete="off"
          className="absolute h-0 w-0 overflow-hidden opacity-0"
          aria-hidden
        />

        <div className="space-y-1.5">
          <Label htmlFor="prayer-intention" className="text-zinc-800">
            Prayer intention<span className="ml-0.5 text-red-600">*</span>
          </Label>
          <textarea
            id="prayer-intention"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            required
            disabled={editing || status === "loading"}
            rows={5}
            className={cn(
              "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
              fieldErrors.intention && "border-red-500",
            )}
          />
          {fieldErrors.intention && <p className="text-xs text-red-600">{fieldErrors.intention}</p>}
        </div>

        <div className="rounded-md border border-border/80">
          <button
            type="button"
            onClick={() => setContactOpen((open) => !open)}
            className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
            aria-expanded={contactOpen}
          >
            <span className="text-sm leading-relaxed text-zinc-600">
              Prayer intentions are anonymous unless you provide us with your name and contact info
            </span>
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform",
                contactOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          {contactOpen && (
            <div className="space-y-4 border-t border-border/80 px-3 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="prayer-name" className="text-zinc-800">
                  Name
                </Label>
                <Input
                  id="prayer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={editing || status === "loading"}
                  className={cn(fieldErrors.name && "border-red-500")}
                />
                {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prayer-email" className="text-zinc-800">
                  Email
                </Label>
                <Input
                  id="prayer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={editing || status === "loading"}
                  className={cn(fieldErrors.email && "border-red-500")}
                />
                {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prayer-phone" className="text-zinc-800">
                  Phone
                </Label>
                <Input
                  id="prayer-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={editing || status === "loading"}
                />
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        )}

        {editing && !preview && (
          <p className="text-xs italic text-zinc-500">Preview only — publish the page to accept submissions.</p>
        )}

        <Button
          type="submit"
          disabled={submitDisabled}
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
