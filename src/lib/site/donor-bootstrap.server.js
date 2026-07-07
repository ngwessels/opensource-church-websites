import "server-only";

import { canAccessDonorPortal, isAdminRole, isFinanceRole, normalizeUserRole } from "@/lib/auth/roles";
import { linkDonorRecordsByEmail, collectStripeCustomerIdsForEmail } from "@/lib/donors/link.server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { syncUserRoleClaim } from "@/lib/firebase/sync-role-claim";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { buildDonorProfileData } from "@/lib/site/bootstrap-data";

export class DonorSignupNotAllowedError extends Error {
  constructor() {
    super("This email is registered for site administration. Sign in at the staff login page.");
    this.code = "staff_account_exists";
  }
}

/**
 * @param {string} uid
 * @param {import("@/types/firestore").UserRole} role
 */
async function ensureRoleClaim(uid, role) {
  await syncUserRoleClaim(uid, role);
}

/**
 * Ensure a Firestore donor profile exists and link past giving records by email.
 *
 * @param {{ uid: string, email?: string, displayName?: string }} user
 * @returns {Promise<{ role: import("@/types/firestore").UserRole, linked: boolean }>}
 */
export async function ensureDonorProfileServer(user) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const userRef = db.collection(COLLECTIONS.users).doc(user.uid);
  const existing = await userRef.get();

  if (existing.exists) {
    const role = normalizeUserRole(existing.data()?.role);
    if (!canAccessDonorPortal(role)) {
      throw new DonorSignupNotAllowedError();
    }

    if (user.email) {
      const stripeCustomerIds = await linkDonorRecordsByEmail(
        db,
        user.uid,
        user.email,
        Array.isArray(existing.data()?.stripeCustomerIds) ? existing.data().stripeCustomerIds : [],
      );
      await userRef.set(
        {
          email: user.email,
          displayName: user.displayName || existing.data()?.displayName || "",
          stripeCustomerIds,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    await ensureRoleClaim(user.uid, role);
    return { role, linked: true };
  }

  if (user.email) {
    const emailMatch = await db
      .collection(COLLECTIONS.users)
      .where("email", "==", user.email.trim())
      .limit(1)
      .get();

    if (!emailMatch.empty) {
      const legacy = emailMatch.docs[0];
      const data = legacy.data();
      const role = normalizeUserRole(data?.role);

      if (isAdminRole(role) || isFinanceRole(role)) {
        throw new DonorSignupNotAllowedError();
      }

      const now = new Date().toISOString();
      await userRef.set({
        email: data.email || user.email,
        displayName: data.displayName || user.displayName || "",
        role,
        ...(data.isFounder ? { isFounder: true } : {}),
        createdAt: data.createdAt || now,
        updatedAt: now,
      });

      if (legacy.id !== user.uid) {
        await legacy.ref.delete();
      }

      if (user.email) {
        await linkDonorRecordsByEmail(db, user.uid, user.email);
      }

      await ensureRoleClaim(user.uid, role);
      return { role, linked: true };
    }
  }

  const stripeCustomerIds = user.email
    ? await collectStripeCustomerIdsForEmail(db, user.email)
    : [];

  const profile = buildDonorProfileData(user, stripeCustomerIds);
  await userRef.set(profile);

  if (user.email) {
    await linkDonorRecordsByEmail(db, user.uid, user.email, stripeCustomerIds);
  }

  await ensureRoleClaim(user.uid, "donor");
  return { role: "donor", linked: Boolean(user.email) };
}
