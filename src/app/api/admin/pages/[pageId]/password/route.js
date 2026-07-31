import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/record.server";
import { revalidateAfterPagePublish } from "@/lib/cache/revalidate-public";
import { getAdminActorFromRequest } from "@/lib/cms/auth";
import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import {
  hashPagePassword,
  isPagePasswordProtected,
  normalizePagePasswordInput,
  wouldProtectHomePage,
} from "@/lib/pages/password";

export const runtime = "nodejs";

function now() {
  return new Date().toISOString();
}

/**
 * PUT — { password } set or change the shared page password.
 * DELETE — remove password protection.
 */
export async function PUT(request, { params }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const actor = await getAdminActorFromRequest(request);
    const { pageId } = await params;
    if (!pageId) {
      return NextResponse.json({ error: "pageId required" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    let password;
    try {
      password = normalizePagePasswordInput(body?.password);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid password" },
        { status: 400 },
      );
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const ref = db.collection(COLLECTIONS.pages).doc(pageId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const before = { id: snap.id, ...snap.data() };
    if (wouldProtectHomePage(before, true)) {
      return NextResponse.json({ error: "The home page cannot be password protected" }, { status: 400 });
    }

    const passwordHash = await hashPagePassword(password);
    const updates = {
      passwordProtected: true,
      passwordHash,
      updatedAt: now(),
    };
    await ref.update(updates);

    const afterSnap = await ref.get();
    const after = { id: afterSnap.id, ...afterSnap.data() };

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: { type: "page", id: pageId, slug: after.slug },
      summary: `Set password protection on page ${after.title || pageId}`,
      before: { ...before, passwordHash: before.passwordHash ? "[redacted]" : undefined },
      after: { ...after, passwordHash: "[redacted]" },
    });

    revalidateAfterPagePublish(after.slug ?? "");

    return NextResponse.json({
      ok: true,
      passwordProtected: true,
      passwordSet: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set password";
    const status = message === "Missing authorization" || message === "Admin access required" ? 401 : 500;
    if (status === 500) console.error("[admin/pages/password PUT]", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const actor = await getAdminActorFromRequest(request);
    const { pageId } = await params;
    if (!pageId) {
      return NextResponse.json({ error: "pageId required" }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const ref = db.collection(COLLECTIONS.pages).doc(pageId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const before = { id: snap.id, ...snap.data() };
    if (!isPagePasswordProtected(before) && before.passwordProtected !== true) {
      return NextResponse.json({
        ok: true,
        passwordProtected: false,
        passwordSet: false,
      });
    }

    await ref.update({
      passwordProtected: false,
      passwordHash: FieldValue.delete(),
      updatedAt: now(),
    });

    const afterSnap = await ref.get();
    const after = { id: afterSnap.id, ...afterSnap.data() };

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: { type: "page", id: pageId, slug: after.slug },
      summary: `Removed password protection from page ${after.title || pageId}`,
      before: { ...before, passwordHash: before.passwordHash ? "[redacted]" : undefined },
      after: { ...after, passwordHash: undefined },
    });

    revalidateAfterPagePublish(after.slug ?? "");

    return NextResponse.json({
      ok: true,
      passwordProtected: false,
      passwordSet: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear password";
    const status = message === "Missing authorization" || message === "Admin access required" ? 401 : 500;
    if (status === 500) console.error("[admin/pages/password DELETE]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
