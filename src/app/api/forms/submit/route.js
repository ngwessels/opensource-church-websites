import { NextResponse } from "next/server";

import { findPublishedFormByFormId } from "@/lib/forms/lookup";
import { formatSubmissionForDisplay, validateSubmission } from "@/lib/forms/schema";
import { uploadFormFile } from "@/lib/forms/upload";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { sendFormNotification } from "@/lib/mailgun/client";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { generateId } from "@/lib/sitemap/tree";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const formId = formData.get("formId");

    if (typeof formId !== "string" || !formId.trim()) {
      return NextResponse.json({ error: "formId is required." }, { status: 400 });
    }

    const found = await findPublishedFormByFormId(formId.trim());
    if (!found) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const { config, pageId, pageTitle, moduleId } = found;

    const honeypot = formData.get(config.honeypotFieldName);
    if (typeof honeypot === "string" && honeypot.trim()) {
      return NextResponse.json({ success: true, message: config.successMessage });
    }

    /** @type {Record<string, unknown>} */
    const values = {};
    /** @type {Record<string, File>} */
    const files = {};

    for (const field of config.fields) {
      if (field.type === "file") {
        const file = formData.get(field.id);
        if (file instanceof File && file.size > 0) {
          files[field.id] = file;
        }
        continue;
      }

      if (field.type === "checkbox" && field.options && field.options.length > 0) {
        values[field.id] = formData.getAll(field.id).map(String);
        continue;
      }

      const raw = formData.get(field.id);
      if (raw !== null && raw !== undefined) {
        values[field.id] = raw instanceof File ? raw.name : String(raw);
      }
    }

    const validation = validateSubmission(config, values, files);
    if (!validation.ok) {
      return NextResponse.json({ error: "Validation failed.", errors: validation.errors }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const submissionId = generateId();
    /** @type {Record<string, unknown>} */
    const storedValues = {};

    for (const [fieldId, value] of Object.entries(validation.values)) {
      if (value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const uploaded = await uploadFormFile(buffer, {
          formId: config.formId,
          submissionId,
          fieldId,
          filename: value.name,
          mimeType: value.type,
        });
        storedValues[fieldId] = uploaded;
      } else {
        storedValues[fieldId] = value;
      }
    }

    const submittedAt = new Date().toISOString();

    await db.collection(COLLECTIONS.formSubmissions).doc(submissionId).set({
      formId: config.formId,
      pageId,
      moduleId,
      pageTitle,
      formTitle: config.title || "Form",
      values: storedValues,
      submittedAt,
      read: false,
    });

    const displayRows = formatSubmissionForDisplay(config, storedValues);

    if (config.notificationEmails.length > 0) {
      await sendFormNotification({
        to: config.notificationEmails,
        formTitle: config.title || "Form",
        pageTitle,
        rows: displayRows,
      });
    }

    return NextResponse.json({
      success: true,
      message: config.successMessage,
      submissionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed.";
    console.error("[forms/submit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
