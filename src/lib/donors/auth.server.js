import "server-only";

import { canAccessDonorPortal } from "@/lib/auth/roles";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

export async function requireDonorPortalAccess(uid) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
  const role = snap.exists ? snap.data()?.role : null;
  if (!canAccessDonorPortal(role)) {
    throw new Error("Donor portal access required");
  }

  return {
    uid,
    role,
    profile: snap.exists ? snap.data() : null,
  };
}

/**
 * @param {import('next/server').Request} request
 */
export async function getDonorPortalUserFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing authorization");
  }
  const idToken = authHeader.slice(7);
  const { verifyFirebaseIdToken } = await import("@/lib/firebase/admin-auth");
  const decoded = await verifyFirebaseIdToken(idToken);
  const result = await requireDonorPortalAccess(decoded.uid);
  return { decoded, ...result };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} uid
 * @param {string} subscriptionId
 */
export async function assertDonorOwnsSubscription(db, uid, subscriptionId) {
  const snap = await db.collection(COLLECTIONS.subscriptions).doc(subscriptionId).get();
  if (!snap.exists) {
    throw new Error("Subscription not found");
  }

  const data = snap.data();
  if (data?.donorUid !== uid) {
    throw new Error("Subscription not found");
  }

  return { ref: snap.ref, data };
}
