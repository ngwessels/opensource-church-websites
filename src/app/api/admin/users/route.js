import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { getFirebaseAdminApp, getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { sendUserInviteEmail } from "@/lib/mailgun/invite";
import { buildUserProfileData } from "@/lib/site/bootstrap-data";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

export const runtime = "nodejs";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
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

    await getAdminUserFromRequest(request);

    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
    const role = body?.role === "admin" ? "admin" : "member";

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

    let inviteSent = false;
    let resetLink = null;

    if (isNewUser) {
      resetLink = await auth.generatePasswordResetLink(email, {
        url: `${getAppUrl()}/login`,
      });

      const siteSnap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
      const siteName = siteSnap.exists ? siteSnap.data()?.name || "your church website" : "your church website";
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

    const body = await request.json();
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";
    const role = body?.role === "admin" ? "admin" : body?.role === "member" ? "member" : null;

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

    await userRef.update({ role, updatedAt: new Date().toISOString() });

    return NextResponse.json({ uid, role });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user role";
    const status =
      message.includes("authorization") || message.includes("Admin access") ? 403 : 500;
    console.error("[admin/users PATCH]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
