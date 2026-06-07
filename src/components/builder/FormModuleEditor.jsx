"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  ClipboardList,
  Download,
  Eye,
  Heart,
  Inbox,
  LayoutTemplate,
  Mail,
  Plus,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FormModule } from "@/components/modules/FormModule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import {
  createEmptyFormField,
  normalizeFormConfig,
  validateFormConfig,
} from "@/lib/forms/schema";
import { FORM_TEMPLATES, getTemplateFields } from "@/lib/forms/templates";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { cn } from "@/lib/utils";

import { FormFieldEditor } from "./FormFieldEditor";

const overlayZ = { zIndex: ADMIN_Z.overlay };

const textareaClassName =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const TEMPLATE_ICONS = {
  contact: Mail,
  new_parishioner: UserPlus,
  volunteer: Users,
  prayer_request: Heart,
};

/**
 * @param {object} props
 * @param {{ config?: import('@/lib/forms/schema.js').FormModuleConfig }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function FormModuleEditor({ module, onSave, onClose }) {
  const initial = normalizeFormConfig(module?.config);
  const { user } = useAuth();

  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [submitLabel, setSubmitLabel] = useState(initial.submitLabel);
  const [successMessage, setSuccessMessage] = useState(initial.successMessage);
  const [notificationEmails, setNotificationEmails] = useState(
    initial.notificationEmails.join(", "),
  );
  const [fields, setFields] = useState(initial.fields);
  const [formId] = useState(initial.formId);
  const [honeypotFieldName] = useState(initial.honeypotFieldName);
  const [saveError, setSaveError] = useState("");
  const [submissions, setSubmissions] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));

  const previewModule = useMemo(
    () => ({
      config: normalizeFormConfig({
        formId,
        title,
        description,
        submitLabel,
        successMessage,
        notificationEmails: parseEmails(notificationEmails),
        fields,
        honeypotFieldName,
      }),
    }),
    [formId, title, description, submitLabel, successMessage, notificationEmails, fields, honeypotFieldName],
  );

  const inputFieldCount = fields.filter(
    (f) => f.type !== "heading" && f.type !== "paragraph",
  ).length;

  useEffect(() => {
    if (!user?.uid || !formId) return;
    const db = getFirebaseFirestore();
    const q = query(collection(db, COLLECTIONS.formSubmissions), where("formId", "==", formId));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
      setSubmissions(rows);
    });
    return () => unsub();
  }, [user?.uid, formId]);

  const newCount = submissions.filter((s) => !s.read).length;

  const getAuthHeaders = useCallback(async () => {
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  async function markRead(submissionIds, read) {
    const headers = await getAuthHeaders();
    await fetch("/api/forms/submissions", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ submissionIds, read }),
    });
  }

  async function exportCsv() {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/forms/submissions?formId=${encodeURIComponent(formId)}&export=csv`, {
      headers,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form-${formId}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateField(index, patch) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch, id: f.id } : f)),
    );
  }

  function removeField(index) {
    setFields((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function moveField(index, direction) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function applyTemplate(templateId) {
    const templateFields = getTemplateFields(templateId);
    if (!templateFields) return;
    if (
      fields.some((f) => f.label.trim()) &&
      !window.confirm("Replace current fields with this template?")
    ) {
      return;
    }
    setFields(templateFields);
    const template = FORM_TEMPLATES.find((t) => t.id === templateId);
    if (template && !title.trim()) {
      setTitle(template.label);
    }
  }

  function handleSave() {
    const config = normalizeFormConfig({
      formId,
      title,
      description,
      submitLabel,
      successMessage,
      notificationEmails: parseEmails(notificationEmails),
      fields,
      honeypotFieldName,
    });
    const validation = validateFormConfig(config);
    if (!validation.ok) {
      setSaveError(validation.error);
      return;
    }
    setSaveError("");
    onSave(config);
  }

  function formatValue(value) {
    if (value === undefined || value === null) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
      const obj = /** @type {{ name?: string, downloadUrl?: string }} */ (value);
      if (obj.downloadUrl) {
        return (
          <a
            href={obj.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {obj.name || "Download file"}
          </a>
        );
      }
      return obj.name || "File";
    }
    return String(value);
  }

  return (
    <div className="fixed inset-0 flex bg-black/60 backdrop-blur-[2px]" style={overlayZ}>
      <div className="flex h-full w-full flex-col bg-background">
        {/* Header */}
        <header className="flex shrink-0 items-center gap-4 border-b border-border bg-card px-6 py-4 shadow-sm">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
            <ClipboardList className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {title.trim() || "Untitled form"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Configure fields, notifications, and review submissions.
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="outline" className="font-normal">
              {inputFieldCount} input{inputFieldCount === 1 ? "" : "s"}
            </Badge>
            {submissions.length > 0 && (
              <Badge variant={newCount > 0 ? "default" : "secondary"} className="font-normal">
                {submissions.length} response{submissions.length === 1 ? "" : "s"}
                {newCount > 0 ? ` · ${newCount} new` : ""}
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </header>

        {saveError && (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-2.5 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Preview panel */}
          <aside className="hidden min-h-0 w-[42%] flex-col border-r border-border xl:flex xl:w-[45%]">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Eye className="h-4 w-4 text-muted-foreground" />
                Live preview
              </div>
              <span className="text-xs text-muted-foreground">Updates as you edit</span>
            </div>
            <ScrollArea className="flex-1 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:20px_20px]">
              <div className="flex min-h-full items-start justify-center p-8 pb-12">
                <div className="w-full max-w-md">
                  <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                    Preview mode — publish the page to accept live submissions.
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-white shadow-xl ring-1 ring-black/[0.04]">
                    <div className="border-b border-border/60 bg-zinc-50 px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <span className="size-2.5 rounded-full bg-red-400/80" aria-hidden />
                        <span className="size-2.5 rounded-full bg-amber-400/80" aria-hidden />
                        <span className="size-2.5 rounded-full bg-emerald-400/80" aria-hidden />
                      </div>
                    </div>
                    <div className="p-6">
                      <FormModule module={previewModule} editing preview />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>

          {/* Editor panel */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
            <Tabs defaultValue="basic" className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-border px-6">
                <TabsList variant="line" className="h-12 w-full justify-start gap-1 rounded-none bg-transparent p-0">
                  <TabsTrigger value="basic" className="gap-1.5 px-4">
                    <Settings2 className="h-3.5 w-3.5" />
                    Basic
                  </TabsTrigger>
                  <TabsTrigger value="fields" className="gap-1.5 px-4">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Fields
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 font-normal">
                      {fields.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="prebuilt" className="gap-1.5 px-4">
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    Prebuilt
                  </TabsTrigger>
                  <TabsTrigger value="responses" className="gap-1.5 px-4">
                    <Inbox className="h-3.5 w-3.5" />
                    Responses
                    {submissions.length > 0 && (
                      <Badge
                        variant={newCount > 0 ? "default" : "secondary"}
                        className="ml-1 h-5 min-w-5 px-1.5 font-normal"
                      >
                        {newCount > 0 ? newCount : submissions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="basic" className="mt-0 min-h-0 flex-1 overflow-auto">
                <ScrollArea className="h-full">
                  <div className="mx-auto max-w-xl space-y-8 px-6 py-6">
                    <section className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Form details</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Title and description appear above the form on your site.
                        </p>
                      </div>
                      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="form-title">Form title</Label>
                          <Input
                            id="form-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Contact us"
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="form-description">Description</Label>
                          <textarea
                            id="form-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Optional intro text for visitors"
                            className={textareaClassName}
                          />
                        </div>
                      </div>
                    </section>

                    <Separator />

                    <section className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Submission</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Button label and confirmation message after a successful submit.
                        </p>
                      </div>
                      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="form-submit-label">Submit button label</Label>
                          <Input
                            id="form-submit-label"
                            value={submitLabel}
                            onChange={(e) => setSubmitLabel(e.target.value)}
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="form-success">Success message</Label>
                          <textarea
                            id="form-success"
                            value={successMessage}
                            onChange={(e) => setSuccessMessage(e.target.value)}
                            rows={2}
                            className={textareaClassName}
                          />
                        </div>
                      </div>
                    </section>

                    <Separator />

                    <section className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Staff receive an email via Mailgun when someone submits this form.
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="form-emails">Notification emails</Label>
                          <Input
                            id="form-emails"
                            value={notificationEmails}
                            onChange={(e) => setNotificationEmails(e.target.value)}
                            placeholder="office@parish.org, pastor@parish.org"
                            className="bg-background"
                          />
                          <p className="text-xs text-muted-foreground">Separate multiple addresses with commas.</p>
                        </div>
                      </div>
                    </section>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="fields" className="mt-0 min-h-0 flex-1 overflow-auto">
                <ScrollArea className="h-full">
                  <div className="mx-auto max-w-2xl space-y-3 px-6 py-6">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Drag order with the arrows. Add headings and paragraphs to organize longer forms.
                      </p>
                    </div>
                    {fields.map((field, index) => (
                      <FormFieldEditor
                        key={field.id}
                        index={index}
                        field={field}
                        onChange={(patch) => updateField(index, patch)}
                        onRemove={() => removeField(index)}
                        onMoveUp={() => moveField(index, -1)}
                        onMoveDown={() => moveField(index, 1)}
                        canMoveUp={index > 0}
                        canMoveDown={index < fields.length - 1}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full border-dashed py-6 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      onClick={() => setFields((prev) => [...prev, createEmptyFormField()])}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add field
                    </Button>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="prebuilt" className="mt-0 min-h-0 flex-1 overflow-auto">
                <ScrollArea className="h-full">
                  <div className="px-6 py-6">
                    <p className="mb-4 text-sm text-muted-foreground">
                      Start from a common parish form template. Applying a template replaces your current fields.
                    </p>
                    <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
                      {FORM_TEMPLATES.map((template) => {
                        const Icon = TEMPLATE_ICONS[template.id] || LayoutTemplate;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => applyTemplate(template.id)}
                            className="group flex gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-teal-600/30 hover:shadow-md"
                          >
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-600/10 text-teal-700 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                              <Icon className="size-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{template.label}</p>
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                {template.description}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {template.fields.length} fields
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="responses" className="mt-0 min-h-0 flex-1 overflow-auto">
                <ScrollArea className="h-full">
                  <div className="px-6 py-6">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Submissions</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {submissions.length === 0
                            ? "Responses will appear here after visitors submit the published form."
                            : `${submissions.length} total${newCount > 0 ? ` · ${newCount} unread` : ""}`}
                        </p>
                      </div>
                      {submissions.length > 0 && (
                        <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                          <Download className="mr-2 h-4 w-4" />
                          Export CSV
                        </Button>
                      )}
                    </div>

                    {submissions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                          <Inbox className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground">No submissions yet</p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          Publish your page and share the link. New responses will show up here in real time.
                        </p>
                      </div>
                    ) : (
                      <div className="mx-auto max-w-3xl space-y-3">
                        {submissions.map((sub) => {
                          const values = /** @type {Record<string, unknown>} */ (sub.values || {});
                          const isUnread = !sub.read;
                          return (
                            <article
                              key={String(sub.id)}
                              className={cn(
                                "overflow-hidden rounded-xl border shadow-sm transition-colors",
                                isUnread
                                  ? "border-teal-600/25 bg-teal-600/[0.03]"
                                  : "border-border bg-card",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isUnread && (
                                    <span className="size-2 rounded-full bg-teal-600" aria-hidden />
                                  )}
                                  <time className="text-xs font-medium text-muted-foreground">
                                    {sub.submittedAt
                                      ? new Date(String(sub.submittedAt)).toLocaleString(undefined, {
                                          dateStyle: "medium",
                                          timeStyle: "short",
                                        })
                                      : "—"}
                                  </time>
                                </div>
                                {isUnread && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => markRead([String(sub.id)], true)}
                                  >
                                    Mark as read
                                  </Button>
                                )}
                              </div>
                              <dl className="divide-y divide-border/60 px-4 py-1">
                                {fields
                                  .filter((f) => f.type !== "heading" && f.type !== "paragraph")
                                  .map((field) => (
                                    <div
                                      key={field.id}
                                      className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-4"
                                    >
                                      <dt className="text-xs font-medium text-muted-foreground">
                                        {field.label}
                                      </dt>
                                      <dd className="text-sm text-foreground break-words">
                                        {formatValue(values[field.id])}
                                      </dd>
                                    </div>
                                  ))}
                              </dl>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @param {string} input */
function parseEmails(input) {
  if (typeof input !== "string" || !input.trim()) return [];
  return input
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}
