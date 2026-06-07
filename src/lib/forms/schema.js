import { generateId } from "../sitemap/tree.js";

/** @typedef {'heading' | 'paragraph' | 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'file'} FormFieldType */

/**
 * @typedef {object} FormField
 * @property {string} id
 * @property {FormFieldType} type
 * @property {string} label
 * @property {string} [placeholder]
 * @property {boolean} [required]
 * @property {string} [helpText]
 * @property {string[]} [options]
 * @property {string} [accept]
 * @property {number} [maxFileSizeMb]
 */

/**
 * @typedef {object} FormModuleConfig
 * @property {string} formId
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} submitLabel
 * @property {string} successMessage
 * @property {string[]} notificationEmails
 * @property {FormField[]} fields
 * @property {string} honeypotFieldName
 */

export const FORM_FIELD_TYPES = [
  "heading",
  "paragraph",
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "date",
  "file",
];

export const INPUT_FIELD_TYPES = new Set([
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "date",
  "file",
]);

export const DISPLAY_FIELD_TYPES = new Set(["heading", "paragraph"]);

const DEFAULT_MAX_FILE_MB = 10;

/**
 * @param {unknown} value
 * @returns {FormFieldType}
 */
function normalizeFieldType(value) {
  if (typeof value === "string" && FORM_FIELD_TYPES.includes(value)) {
    return /** @type {FormFieldType} */ (value);
  }
  return "text";
}

/**
 * @param {unknown} raw
 * @returns {FormField}
 */
export function normalizeFormField(raw) {
  if (!raw || typeof raw !== "object") {
    return createEmptyFormField("text");
  }

  const f = /** @type {Record<string, unknown>} */ (raw);
  const type = normalizeFieldType(f.type);
  const options = Array.isArray(f.options)
    ? f.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
    : [];

  return {
    id: typeof f.id === "string" && f.id.trim() ? f.id.trim() : generateId(),
    type,
    label: typeof f.label === "string" ? f.label : "",
    ...(typeof f.placeholder === "string" && f.placeholder.trim()
      ? { placeholder: f.placeholder.trim() }
      : {}),
    ...(f.required === true ? { required: true } : {}),
    ...(typeof f.helpText === "string" && f.helpText.trim() ? { helpText: f.helpText.trim() } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(typeof f.accept === "string" && f.accept.trim() ? { accept: f.accept.trim() } : {}),
    ...(typeof f.maxFileSizeMb === "number" && f.maxFileSizeMb > 0
      ? { maxFileSizeMb: f.maxFileSizeMb }
      : type === "file"
        ? { maxFileSizeMb: DEFAULT_MAX_FILE_MB }
        : {}),
  };
}

/**
 * @param {FormFieldType} [type]
 * @returns {FormField}
 */
export function createEmptyFormField(type = "text") {
  return normalizeFormField({ id: generateId(), type, label: "", required: false });
}

function generateHoneypotName() {
  return `_hp_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {unknown} raw
 * @param {{ preserveFormId?: boolean }} [options]
 * @returns {FormModuleConfig}
 */
export function normalizeFormConfig(raw, options = {}) {
  const { preserveFormId = true } = options;

  if (!raw || typeof raw !== "object") {
    return {
      formId: generateId(),
      title: "Contact Form",
      description: "",
      submitLabel: "Submit",
      successMessage: "Thank you! Your submission has been received.",
      notificationEmails: [],
      fields: [],
      honeypotFieldName: generateHoneypotName(),
    };
  }

  const c = /** @type {Record<string, unknown>} */ (raw);
  const fields = Array.isArray(c.fields) ? c.fields.map(normalizeFormField) : [];
  const emails = Array.isArray(c.notificationEmails)
    ? c.notificationEmails
        .filter((e) => typeof e === "string" && e.includes("@"))
        .map((e) => e.trim())
    : [];

  return {
    formId:
      preserveFormId && typeof c.formId === "string" && c.formId.trim()
        ? c.formId.trim()
        : generateId(),
    title: typeof c.title === "string" ? c.title.trim() : "Contact Form",
    description: typeof c.description === "string" ? c.description.trim() : "",
    submitLabel:
      typeof c.submitLabel === "string" && c.submitLabel.trim() ? c.submitLabel.trim() : "Submit",
    successMessage:
      typeof c.successMessage === "string" && c.successMessage.trim()
        ? c.successMessage.trim()
        : "Thank you! Your submission has been received.",
    notificationEmails: emails,
    fields,
    honeypotFieldName:
      typeof c.honeypotFieldName === "string" && c.honeypotFieldName.trim()
        ? c.honeypotFieldName.trim()
        : generateHoneypotName(),
  };
}

/**
 * @param {FormModuleConfig} config
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateFormConfig(config) {
  const inputFields = config.fields.filter((f) => INPUT_FIELD_TYPES.has(f.type));
  if (inputFields.length === 0) {
    return { ok: false, error: "Add at least one input field." };
  }

  for (const field of config.fields) {
    if (DISPLAY_FIELD_TYPES.has(field.type)) continue;
    if (!field.label.trim()) {
      return { ok: false, error: "Every field must have a label." };
    }
    if (
      (field.type === "select" || field.type === "radio") &&
      (!field.options || field.options.length === 0)
    ) {
      return { ok: false, error: `${field.label} needs at least one option.` };
    }
  }

  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {FormField} field
 * @param {unknown} value
 * @returns {string | null}
 */
function validateFieldValue(field, value) {
  if (DISPLAY_FIELD_TYPES.has(field.type)) return null;

  const str = typeof value === "string" ? value.trim() : "";
  const isEmpty =
    value === undefined ||
    value === null ||
    str === "" ||
    (Array.isArray(value) && value.length === 0);

  if (field.required && isEmpty) {
    return `${field.label} is required.`;
  }

  if (isEmpty) return null;

  if (field.type === "email" && !EMAIL_RE.test(str)) {
    return `${field.label} must be a valid email address.`;
  }

  if (field.type === "select" || field.type === "radio") {
    if (!field.options?.includes(str)) {
      return `${field.label} has an invalid selection.`;
    }
  }

  if (field.type === "checkbox") {
    if (field.options && field.options.length > 0) {
      const selected = Array.isArray(value) ? value : [value].filter(Boolean);
      for (const item of selected) {
        if (typeof item !== "string" || !field.options.includes(item)) {
          return `${field.label} has an invalid selection.`;
        }
      }
    }
  }

  return null;
}

/**
 * @param {FormModuleConfig} config
 * @param {Record<string, unknown>} values
 * @param {Record<string, File>} [files]
 * @returns {{ ok: true, values: Record<string, unknown> } | { ok: false, errors: Record<string, string> }}
 */
export function validateSubmission(config, values, files = {}) {
  /** @type {Record<string, string>} */
  const errors = {};
  /** @type {Record<string, unknown>} */
  const normalized = {};

  for (const field of config.fields) {
    if (DISPLAY_FIELD_TYPES.has(field.type)) continue;

    if (field.type === "file") {
      const file = files[field.id];
      if (field.required && !file) {
        errors[field.id] = `${field.label} is required.`;
        continue;
      }
      if (file) {
        const maxMb = field.maxFileSizeMb ?? DEFAULT_MAX_FILE_MB;
        if (file.size > maxMb * 1024 * 1024) {
          errors[field.id] = `${field.label} must be under ${maxMb} MB.`;
          continue;
        }
        if (field.accept) {
          const allowed = field.accept.split(",").map((a) => a.trim().toLowerCase());
          const mime = (file.type || "").toLowerCase();
          const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
          const ok = allowed.some(
            (a) => a === mime || a === ext || (a.endsWith("/*") && mime.startsWith(a.slice(0, -1))),
          );
          if (!ok) {
            errors[field.id] = `${field.label} has an unsupported file type.`;
            continue;
          }
        }
        normalized[field.id] = file;
      }
      continue;
    }

    const raw = values[field.id];
    let parsed = raw;

    if (field.type === "checkbox") {
      if (field.options && field.options.length > 0) {
        parsed = Array.isArray(raw) ? raw : raw ? [raw] : [];
      } else {
        parsed = raw === true || raw === "true" || raw === "on";
        if (field.required && !parsed) {
          errors[field.id] = `${field.label} must be checked.`;
          continue;
        }
      }
    }

    const err = validateFieldValue(field, parsed);
    if (err) {
      errors[field.id] = err;
    } else if (!DISPLAY_FIELD_TYPES.has(field.type)) {
      if (field.type !== "file") {
        normalized[field.id] = parsed;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, values: normalized };
}

/**
 * Format submission values for display/email (non-file fields).
 * @param {FormModuleConfig} config
 * @param {Record<string, unknown>} values
 * @returns {Array<{ label: string, value: string }>}
 */
export function formatSubmissionForDisplay(config, values) {
  const rows = [];
  for (const field of config.fields) {
    if (DISPLAY_FIELD_TYPES.has(field.type)) continue;
    const raw = values[field.id];
    if (raw === undefined || raw === null) continue;

    if (field.type === "file" && raw && typeof raw === "object") {
      const f = /** @type {{ name?: string }} */ (raw);
      rows.push({ label: field.label, value: f.name || "File attached" });
      continue;
    }

    if (field.type === "checkbox" && Array.isArray(raw)) {
      rows.push({ label: field.label, value: raw.join(", ") });
      continue;
    }

    if (typeof raw === "boolean") {
      rows.push({ label: field.label, value: raw ? "Yes" : "No" });
      continue;
    }

    rows.push({ label: field.label, value: String(raw) });
  }
  return rows;
}
