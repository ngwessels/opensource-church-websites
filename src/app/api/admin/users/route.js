import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { syncUserRoleClaim } from "@/lib/firebase/sync-role-claim";
import { normalizeUserRole } from "@/lib/auth/roles";

import { getAdminActorFromRequest, getAdminUserFromRequest } from "@/lib/cms/auth";
import { recordAuditEvent } from "@/lib/audit/record.server";
import { getFirebaseAdminApp, getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { sendUserInviteEmail } from "@/lib/mailgun/invite";
import { getSiteBaseUrl } from "@/lib/seo/site-url";
import { buildUserProfileData } from "@/lib/site/bootstrap-data";
import { isFounderUserServer } from "@/lib/site/founder.server";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

export const runtime = "nodejs";

function getInviteContinueUrl(siteConfig) {
  const baseUrl = getSiteBaseUrl(siteConfig);
  try {
    return new URL("/login", `${baseUrl}/`).toString();
  } catch {
    throw new Error(
      "Site URL is not configured. Set canonical domain in Admin settings or NEXT_PUBLIC_APP_URL to a valid https URL.",
    );
  }
}

async function countAdmins(db) {
  const snap = await db.collection(COLLECTIONS.users).where("role", "==", "admin").get();
  return snap.size;
}

/** POST { email, displayName?, role } — invite a user */
export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const actor = await getAdminActorFromRequest(request);

    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
    const role = normalizeUserRole(body?.role);

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const app = getFirebaseAdminApp();
    const db = getFirebaseAdminFirestore();
    if (!app || !db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const auth = getAuth(app);
    let uid;
    let isNewUser = false;

    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const created = await auth.createUser({
        email,
        ...(displayName ? { displayName } : {}),
        emailVerified: false,
      });
      uid = created.uid;
      isNewUser = true;
    }

    const now = new Date().toISOString();
    const userRef = db.collection(COLLECTIONS.users).doc(uid);
    const existingProfile = await userRef.get();
    const before = existingProfile.exists ? { id: uid, ...existingProfile.data() } : null;

    if (existingProfile.exists) {
      await userRef.update({
        email,
        ...(displayName ? { displayName } : {}),
        role,
        updatedAt: now,
      });
    } else {
      await userRef.set(buildUserProfileData({ email, displayName }, role));
    }

    const afterSnap = await userRef.get();
    const after = { id: uid, ...afterSnap.data() };

    await recordAuditEvent({
      action: before ? "update" : "create",
      actor,
      source: "api",
      resource: { type: "user", id: uid, apiRoute: "/api/admin/users" },
      summary: before ? `Updated user ${email}` : `Invited user ${email}`,
      before: before ?? undefined,
      after,
    });

    let inviteSent = false;
    let resetLink = null;

    if (isNewUser) {
      const siteSnap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
      const siteConfig = siteSnap.exists ? siteSnap.data() : null;
      const siteName = siteConfig?.name || "your church website";

      resetLink = await auth.generatePasswordResetLink(email, {
        url: getInviteContinueUrl(siteConfig),
      });
      const emailResult = await sendUserInviteEmail({ to: email, resetLink, siteName });
      inviteSent = emailResult.sent;
    }

    return NextResponse.json({
      uid,
      email,
      role,
      isNewUser,
      inviteSent,
      ...(resetLink && !inviteSent ? { resetLink } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to invite user";
    const status =
      message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    console.error("[admin/users POST]", message);
    return NextResponse.json({ error: message }, { status });
  }
}

/** PATCH { uid, role } — update user role */
export async function PATCH(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const adminUser = await getAdminUserFromRequest(request);
    const actor = await getAdminActorFromRequest(request);

    const body = await request.json();
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";
    const requestedRole = normalizeUserRole(body?.role);
    const role = body?.role === "admin" || body?.role === "finance" || body?.role === "member"
      ? requestedRole
      : null;

    if (!uid || !role) {
      return NextResponse.json({ error: "uid and role are required" }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const userRef = db.collection(COLLECTIONS.users).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (role === "member" && (await isFounderUserServer(uid))) {
      return NextResponse.json({ error: "Cannot demote the original site owner" }, { status: 400 });
    }

    if (userSnap.data()?.role === "admin" && role === "member") {
      const adminCount = await countAdmins(db);
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot demote the last admin" }, { status: 400 });
      }
    }

    if (uid === adminUser.uid && role === "member") {
      const adminCount = await countAdmins(db);
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot demote yourself as the last admin" }, { status: 400 });
      }
    }

    const before = { id: uid, ...userSnap.data() };
    await userRef.update({ role, updatedAt: new Date().toISOString() });
    await syncUserRoleClaim(uid, role);

    const afterSnap = await userRef.get();
    const after = { id: uid, ...afterSnap.data() };

    await recordAuditEvent({
      action: "update",
      actor,
      source: "api",
      resource: { type: "user", id: uid, apiRoute: "/api/admin/users" },
      summary: `Changed user role to ${role}`,
      before,
      after,
    });

    return NextResponse.json({ uid, role });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user role";
    const status =
      message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    console.error("[admin/users PATCH]", message);
    return NextResponse.json({ error: message }, { status });
  }
}

/** DELETE { uid } — remove user profile and Firebase Auth account */
export async function DELETE(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const adminUser = await getAdminUserFromRequest(request);
    const actor = await getAdminActorFromRequest(request);

    const body = await request.json();
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const app = getFirebaseAdminApp();
    const db = getFirebaseAdminFirestore();
    if (!app || !db) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const userRef = db.collection(COLLECTIONS.users).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (await isFounderUserServer(uid)) {
      return NextResponse.json({ error: "Cannot remove the original site owner" }, { status: 400 });
    }

    if (userSnap.data()?.role === "admin") {
      const adminCount = await countAdmins(db);
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 400 });
      }
    }

    if (uid === adminUser.uid) {
      const adminCount = await countAdmins(db);
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot remove yourself as the last admin" }, { status: 400 });
      }
    }

    const before = { id: uid, ...userSnap.data() };
    const auth = getAuth(app);
    try {
      await auth.deleteUser(uid);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      if (code !== "auth/user-not-found") {
        throw err;
      }
    }

    await userRef.delete();

    await recordAuditEvent({
      action: "delete",
      actor,
      source: "api",
      resource: { type: "user", id: uid, apiRoute: "/api/admin/users" },
      summary: `Removed user ${before.email || uid}`,
      before,
    });

    return NextResponse.json({ uid, removed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove user";
    const status =
      message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    console.error("[admin/users DELETE]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
