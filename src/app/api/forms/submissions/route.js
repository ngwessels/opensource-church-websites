import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizeFormConfig } from "@/lib/forms/schema";
import { findPublishedFormByFormId } from "@/lib/forms/lookup";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET ?formId=... — list submissions
 * GET ?formId=...&export=csv — CSV export
 * PATCH { submissionIds: string[], read: boolean } — mark read/unread
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    await getAdminUserFromRequest(request);

    const { searchParams } = new URL(request.url);
    const formId = searchParams.get("formId");
    if (!formId) {
      return NextResponse.json({ error: "formId is required." }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const snap = await db.collection(COLLECTIONS.formSubmissions).where("formId", "==", formId).get();

    const submissions = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));

    if (searchParams.get("export") === "csv") {
      const found = await findPublishedFormByFormId(formId);
      const config = found?.config ?? normalizeFormConfig(null);
      const fieldLabels = config.fields
        .filter((f) => f.type !== "heading" && f.type !== "paragraph")
        .map((f) => ({ id: f.id, label: f.label }));

      const header = ["Submitted At", "Read", ...fieldLabels.map((f) => f.label)];
      const rows = submissions.map((sub) => {
        const values = /** @type {Record<string, unknown>} */ (sub.values || {});
        return [
          sub.submittedAt || "",
          sub.read ? "Yes" : "No",
          ...fieldLabels.map((f) => formatCsvCell(values[f.id])),
        ];
      });

      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="form-${formId}-submissions.csv"`,
        },
      });
    }

    return NextResponse.json({ submissions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }
    await getAdminUserFromRequest(request);

    const body = await request.json();
    const submissionIds = Array.isArray(body.submissionIds) ? body.submissionIds : [];
    const read = body.read === true;

    if (submissionIds.length === 0) {
      return NextResponse.json({ error: "submissionIds is required." }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const batch = db.batch();
    for (const id of submissionIds) {
      if (typeof id !== "string") continue;
      batch.update(db.collection(COLLECTIONS.formSubmissions).doc(id), { read });
    }
    await batch.commit();

    return NextResponse.json({ updated: submissionIds.length, read });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** @param {unknown} value */
function formatCsvCell(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const obj = /** @type {{ name?: string }} */ (value);
    return obj.name || "File";
  }
  return String(value);
}
