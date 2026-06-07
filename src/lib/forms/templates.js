import { generateId } from "../sitemap/tree.js";

import { normalizeFormField } from "./schema.js";

/**
 * @typedef {object} FormTemplate
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {import('./schema.js').FormField[]} fields
 */

/** @param {Partial<import('./schema.js').FormField> & { type: import('./schema.js').FormFieldType, label: string }} field */
function field(fieldDef) {
  return normalizeFormField({ id: generateId(), ...fieldDef });
}

/** @type {FormTemplate[]} */
export const FORM_TEMPLATES = [
  {
    id: "contact",
    label: "Contact Us",
    description: "Name, email, phone, and message fields for general inquiries.",
    fields: [
      field({ type: "text", label: "Name", required: true }),
      field({ type: "email", label: "Email", required: true }),
      field({ type: "phone", label: "Phone" }),
      field({ type: "textarea", label: "Message", required: true, placeholder: "How can we help?" }),
    ],
  },
  {
    id: "new_parishioner",
    label: "New Parishioner",
    description: "Registration form for new parish members.",
    fields: [
      field({ type: "heading", label: "Personal Information" }),
      field({ type: "text", label: "Full Name", required: true }),
      field({ type: "email", label: "Email", required: true }),
      field({ type: "phone", label: "Phone", required: true }),
      field({ type: "text", label: "Address", required: true }),
      field({ type: "date", label: "Date of Birth" }),
      field({ type: "text", label: "Previous Parish" }),
    ],
  },
  {
    id: "volunteer",
    label: "Volunteer Sign-up",
    description: "Collect volunteer interest and availability.",
    fields: [
      field({ type: "text", label: "Name", required: true }),
      field({ type: "email", label: "Email", required: true }),
      field({ type: "phone", label: "Phone" }),
      field({
        type: "select",
        label: "Area of Interest",
        required: true,
        options: ["Liturgy", "Faith Formation", "Outreach", "Maintenance", "Other"],
      }),
      field({
        type: "textarea",
        label: "Availability",
        placeholder: "Days/times you are available",
      }),
    ],
  },
  {
    id: "prayer_request",
    label: "Prayer Request",
    description: "Submit prayer intentions to the parish.",
    fields: [
      field({ type: "paragraph", label: "Your prayer intention will be shared with our parish community." }),
      field({ type: "text", label: "Name" }),
      field({ type: "email", label: "Email" }),
      field({ type: "textarea", label: "Prayer Request", required: true }),
    ],
  },
];

/**
 * @param {string} templateId
 * @returns {import('./schema.js').FormField[] | null}
 */
export function getTemplateFields(templateId) {
  const template = FORM_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return null;
  return template.fields.map((f) => normalizeFormField({ ...f, id: generateId() }));
}
