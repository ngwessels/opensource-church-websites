import "server-only";

import { randomBytes } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { getAuthCodeTtlSeconds } from "@/lib/oauth/config";

function getDb() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");
  return db;
}

function now() {
  return new Date().toISOString();
}

export async function createAuthorizationCode({
  uid,
  clientId,
  redirectUri,
  codeChallenge,
  codeChallengeMethod,
  scopes,
  state,
}) {
  const code = randomBytes(32).toString("base64url");
  const codeId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + getAuthCodeTtlSeconds() * 1000).toISOString();

  await getDb()
    .collection(COLLECTIONS.mcpOAuthCodes)
    .doc(codeId)
    .set({
      code,
      uid,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scopes,
      state,
      used: false,
      createdAt: now(),
      expiresAt,
    });

  return code;
}

export async function consumeAuthorizationCode(code, clientId, redirectUri) {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.mcpOAuthCodes)
    .where("code", "==", code)
    .where("clientId", "==", clientId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data();

  if (data.used) return null;
  if (data.redirectUri !== redirectUri) return null;
  if (new Date(data.expiresAt).getTime() < Date.now()) return null;

  await doc.ref.update({ used: true, usedAt: now() });
  return { id: doc.id, ...data };
}
